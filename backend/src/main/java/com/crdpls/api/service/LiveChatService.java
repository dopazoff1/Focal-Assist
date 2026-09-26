package com.crdpls.api.service;

import com.crdpls.api.models.*;
import com.crdpls.api.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@Transactional
public class LiveChatService {
    private static final List<String> ACTIVE_STATUSES = List.of("BOT_ACTIVE", "WAITING_FOR_QUEUE", "WAITING_FOR_AGENT", "ASSIGNED_TO_AGENT");
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final ChatProjectService projectService;
    private final ChatQueueRepository queueRepository;
    private final ChatQueueAgentRepository queueAgentRepository;
    private final LiveChatSessionRepository sessionRepository;
    private final LiveChatMessageRepository messageRepository;
    private final LiveChatAssignmentRepository assignmentRepository;
    private final WorkflowExecutionRepository executionRepository;
    private final UserRepository userRepository;
    private final LiveChatBroadcaster broadcaster;
    private final Map<Long, Map<Long, LocalDateTime>> typingBySession = new ConcurrentHashMap<>();

    public LiveChatService(
        ChatProjectService projectService,
        ChatQueueRepository queueRepository,
        ChatQueueAgentRepository queueAgentRepository,
        LiveChatSessionRepository sessionRepository,
        LiveChatMessageRepository messageRepository,
        LiveChatAssignmentRepository assignmentRepository,
        WorkflowExecutionRepository executionRepository,
        UserRepository userRepository,
        LiveChatBroadcaster broadcaster
    ) {
        this.projectService = projectService;
        this.queueRepository = queueRepository;
        this.queueAgentRepository = queueAgentRepository;
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.assignmentRepository = assignmentRepository;
        this.executionRepository = executionRepository;
        this.userRepository = userRepository;
        this.broadcaster = broadcaster;
    }

    public Map<String, Object> getPublicProject(String slug) {
        ChatProject project = projectService.requirePublicProject(slug);
        Map<String, Object> dto = projectService.toProjectDto(project);
        dto.put("queues", queueRepository.findByProjectIdAndArchivedFalseOrderByPriorityAscNameAsc(project.getId()).stream()
            .map(projectService::toQueueDto)
            .toList());
        return dto;
    }

    public Map<String, Object> startPublicSession(String slug, Map<String, Object> request) {
        ChatProject project = projectService.requirePublicProject(slug);
        LiveChatSession session = new LiveChatSession();
        session.setProject(project);
        session.setPublicToken(UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().substring(0, 8));
        session.setCustomerName(trimToDefault(asString(request.get("customerName")), "Guest"));
        session.setCustomerEmail(trim(asString(request.get("customerEmail"))));
        session.setStatus("BOT_ACTIVE");
        session = sessionRepository.save(session);
        addMessage(session, "SYSTEM", null, "Conversation started for " + session.getCustomerName(), "{}");
        runWorkflowFromStart(session);
        return sessionBundle(session);
    }

    public Map<String, Object> externalStartSession(ChatProjectApiKey apiKey, Map<String, Object> request) {
        LiveChatSession session = new LiveChatSession();
        session.setProject(apiKey.getProject());
        session.setPublicToken(UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().substring(0, 8));
        session.setCustomerName(trimToDefault(asString(request.get("customerName")), "External customer"));
        session.setCustomerEmail(trim(asString(request.get("customerEmail"))));
        session.setStatus("BOT_ACTIVE");
        session = sessionRepository.save(session);
        addMessage(session, "SYSTEM", null, "Conversation opened through project API.", "{}");
        runWorkflowFromStart(session);
        return sessionBundle(session);
    }

    public List<Map<String, Object>> getPublicMessages(String token) {
        LiveChatSession session = requirePublicSession(token);
        session.setUnreadForCustomer(0);
        sessionRepository.save(session);
        return messages(session);
    }

    public Map<String, Object> getPublicSession(String token) {
        LiveChatSession session = requirePublicSession(token);
        session.setUnreadForCustomer(0);
        sessionRepository.save(session);
        return sessionBundle(session);
    }

    public Map<String, Object> sendPublicMessage(String token, Map<String, Object> request) {
        LiveChatSession session = requirePublicSession(token);
        if ("CLOSED".equals(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conversation is closed.");
        }
        String body = trim(asString(request.get("body")));
        if (body.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message is required.");
        }
        addMessage(session, "CUSTOMER", null, body, "{}");
        session.setUnreadForAgent(nullSafe(session.getUnreadForAgent()) + 1);
        if ("BOT_ACTIVE".equals(session.getStatus())) {
            advanceWorkflow(session, body);
        }
        sessionRepository.save(session);
        Map<String, Object> bundle = sessionBundle(session);
        broadcaster.broadcastSession(session.getId(), "message", bundle);
        return bundle;
    }

    public Map<String, Object> submitPublicCsat(String token, Map<String, Object> request) {
        LiveChatSession session = requirePublicSession(token);
        if (!"CLOSED".equals(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSAT can only be submitted after the conversation is closed.");
        }

        int rating = asInt(request.get("rating"));
        if (rating < 1 || rating > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating must be between 1 and 5.");
        }

        boolean alreadySubmitted = messageRepository.findBySessionIdOrderByCreatedAtAscIdAsc(session.getId()).stream()
            .anyMatch(message -> trim(message.getMetadataJson()).contains("\"type\":\"CSAT\""));
        if (!alreadySubmitted) {
            String comment = truncate(trim(asString(request.get("comment"))), 1200);
            String body = "CSAT received: " + rating + "/5" + (comment.isBlank() ? "" : "\n" + comment);
            addMessage(session, "SYSTEM", null, body, toJson(Map.of(
                "type", "CSAT",
                "rating", rating,
                "comment", comment
            )));
        }

        Map<String, Object> bundle = sessionBundle(session);
        broadcaster.broadcastSession(session.getId(), "csat", bundle);
        return bundle;
    }

    public List<Map<String, Object>> searchSessions(User user, Long projectId, Long queueId, String status, Long agentId) {
        if (isAgentOnly(user)) {
            return sessionRepository.findByAssignedAgentIdOrderByUpdatedAtDesc(user.getId()).stream()
                .filter(s -> projectId == null || Objects.equals(s.getProject().getId(), projectId))
                .filter(s -> queueId == null || (s.getQueue() != null && Objects.equals(s.getQueue().getId(), queueId)))
                .filter(s -> status == null || status.isBlank() || status.equals(s.getStatus()))
                .map(this::toSessionDto)
                .toList();
        }
        return sessionRepository.search(projectId, queueId, blankToNull(status), agentId).stream()
            .map(this::toSessionDto)
            .toList();
    }

    public Map<String, Object> claimNext(User user, Long projectId) {
        List<ChatQueueAgent> memberships = projectId == null
            ? List.of()
            : queueAgentRepository.findByQueueProjectIdAndUserIdAndActiveTrue(projectId, user.getId());
        Optional<LiveChatSession> candidate;
        if (!memberships.isEmpty()) {
            List<Long> queueIds = memberships.stream().map(row -> row.getQueue().getId()).toList();
            candidate = sessionRepository.claimOldestUnassignedForQueues(queueIds);
        } else if (canSeeAll(user)) {
            candidate = sessionRepository.claimOldestUnassigned(projectId);
        } else {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not assigned to any queue for this project.");
        }
        LiveChatSession session = candidate.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No waiting chats available."));
        assignSession(session, user);
        addMessage(session, "SYSTEM", user, displayName(user) + " joined the conversation.", "{}");
        Map<String, Object> bundle = sessionBundle(session);
        broadcaster.broadcastSession(session.getId(), "assignment", bundle);
        return bundle;
    }

    public Map<String, Object> assignSessionToAgent(User currentUser, Long sessionId, Long agentId) {
        if (!canSeeAll(currentUser)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only supervisors can manually assign chats.");
        }
        LiveChatSession session = requireSession(sessionId);
        User agent = userRepository.findById(agentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Agent not found."));
        assignSession(session, agent);
        addMessage(session, "SYSTEM", currentUser, displayName(agent) + " was assigned to this chat.", "{}");
        Map<String, Object> bundle = sessionBundle(session);
        broadcaster.broadcastSession(session.getId(), "assignment", bundle);
        return bundle;
    }

    public List<Map<String, Object>> getMessages(User user, Long sessionId) {
        LiveChatSession session = requireVisibleSession(user, sessionId);
        if (session.getAssignedAgent() != null && Objects.equals(session.getAssignedAgent().getId(), user.getId())) {
            session.setUnreadForAgent(0);
            sessionRepository.save(session);
        }
        return messages(session);
    }

    public Map<String, Object> sendAgentMessage(User user, Long sessionId, Map<String, Object> request) {
        LiveChatSession session = requireVisibleSession(user, sessionId);
        if ("CLOSED".equals(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conversation is closed.");
        }
        if (session.getAssignedAgent() == null) {
            assignSession(session, user);
        } else if (!Objects.equals(session.getAssignedAgent().getId(), user.getId()) && !canSeeAll(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This chat is assigned to another agent.");
        }
        String body = trim(asString(request.get("body")));
        if (body.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message is required.");
        addMessage(session, "AGENT", user, body, "{}");
        session.setStatus("ASSIGNED_TO_AGENT");
        session.setUnreadForCustomer(nullSafe(session.getUnreadForCustomer()) + 1);
        sessionRepository.save(session);
        Map<String, Object> bundle = sessionBundle(session);
        broadcaster.broadcastSession(session.getId(), "message", bundle);
        return bundle;
    }

    public Map<String, Object> closeSession(User user, Long sessionId) {
        LiveChatSession session = requireVisibleSession(user, sessionId);
        if (session.getAssignedAgent() != null && !Objects.equals(session.getAssignedAgent().getId(), user.getId()) && !canSeeAll(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This chat is assigned to another agent.");
        }
        session.setStatus("CLOSED");
        session.setClosedAt(LocalDateTime.now());
        sessionRepository.save(session);
        addMessage(session, "SYSTEM", user, "Conversation closed.", "{}");
        Map<String, Object> bundle = sessionBundle(session);
        broadcaster.broadcastSession(session.getId(), "status", bundle);
        return bundle;
    }

    public Map<String, Object> setTyping(User user, Long sessionId, boolean typing) {
        LiveChatSession session = requireVisibleSession(user, sessionId);
        typingBySession.computeIfAbsent(session.getId(), id -> new ConcurrentHashMap<>());
        if (typing) {
            typingBySession.get(session.getId()).put(user.getId(), LocalDateTime.now().plusSeconds(8));
        } else {
            typingBySession.get(session.getId()).remove(user.getId());
        }
        Map<String, Object> payload = Map.of("user", displayName(user), "typing", typing);
        broadcaster.broadcastSession(session.getId(), "typing", payload);
        return payload;
    }

    public Map<String, Object> sessionBundle(LiveChatSession session) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("session", toSessionDto(session));
        dto.put("messages", messages(session));
        return dto;
    }

    private void runWorkflowFromStart(LiveChatSession session) {
        Optional<ChatWorkflow> workflowOpt = projectService.activeWorkflow(session.getProject().getId());
        if (workflowOpt.isEmpty()) {
            addMessage(session, "BOT", null, trimToDefault(session.getProject().getWelcomeMessage(), "Hi. How can we help?"), "{}");
            escalateToDefaultQueue(session);
            return;
        }
        ChatWorkflow workflow = workflowOpt.get();
        List<ChatWorkflowNode> nodes = projectService.workflowNodes(workflow.getId());
        ChatWorkflowNode start = nodes.stream().filter(node -> "START".equals(node.getType())).findFirst().orElse(null);
        if (start == null) {
            addMessage(session, "BOT", null, trimToDefault(session.getProject().getWelcomeMessage(), "Hi. How can we help?"), "{}");
            return;
        }
        session.setCurrentNodeId(start.getClientNodeId());
        visitNode(session, workflow, start, null);
        sessionRepository.save(session);
    }

    private void advanceWorkflow(LiveChatSession session, String customerMessage) {
        Optional<ChatWorkflow> workflowOpt = projectService.activeWorkflow(session.getProject().getId());
        if (workflowOpt.isEmpty()) {
            escalateToDefaultQueue(session);
            return;
        }
        ChatWorkflow workflow = workflowOpt.get();
        String currentNodeId = session.getCurrentNodeId();
        if (currentNodeId == null || currentNodeId.isBlank()) {
            runWorkflowFromStart(session);
            return;
        }
        ChatWorkflowNode currentNode = findNode(workflow, currentNodeId);
        if (currentNode == null) {
            escalateToDefaultQueue(session);
            return;
        }
        recordExecution(session, currentNodeId, "INPUT", toJson(Map.of("text", trim(customerMessage))));
        List<ChatWorkflowConnection> outgoing = projectService.outgoing(workflow.getId(), currentNodeId);
        ChatWorkflowConnection selected = selectConnection(currentNode, outgoing, customerMessage);
        if (selected == null && !outgoing.isEmpty()) {
            String retry = retryMessageFor(currentNode);
            addMessage(session, "BOT", null, retry, metadataForNode(currentNode));
            return;
        }
        if (selected == null) {
            escalateToDefaultQueue(session);
            return;
        }
        ChatWorkflowNode next = findNode(workflow, selected.getTargetNodeId());
        if (next == null) {
            escalateToDefaultQueue(session);
            return;
        }
        session.setCurrentNodeId(next.getClientNodeId());
        visitNode(session, workflow, next, customerMessage);
    }

    private void visitNode(LiveChatSession session, ChatWorkflow workflow, ChatWorkflowNode node, String customerMessage) {
        recordExecution(session, node.getClientNodeId(), "VISIT", "{}");
        Map<String, Object> props = projectService.fromJsonMap(node.getPropertiesJson());
        switch (node.getType()) {
            case "START" -> followFirst(session, workflow, node);
            case "MESSAGE" -> {
                addMessage(session, "BOT", null, trimToDefault(asString(firstNonNull(props.get("message"), props.get("text"))), node.getTitle()), "{}");
                followFirst(session, workflow, node);
            }
            case "QUESTION", "CHOICE", "CHOICE_RESPONSE" -> {
                String message = trimToDefault(asString(firstNonNull(props.get("message"), props.get("question"))), node.getTitle());
                addMessage(session, "BOT", null, appendOptions(message, choiceOptions(props)), metadataForNode(node));
                session.setCurrentNodeId(node.getClientNodeId());
            }
            case "TEXT_ENTRY" -> {
                String message = trimToDefault(asString(firstNonNull(props.get("message"), props.get("question"))), node.getTitle());
                addMessage(session, "BOT", null, message, metadataForNode(node));
                session.setCurrentNodeId(node.getClientNodeId());
            }
            case "BOOLEAN_RESPONSE" -> {
                String message = trimToDefault(asString(firstNonNull(props.get("message"), props.get("question"))), node.getTitle());
                addMessage(session, "BOT", null, appendOptions(message, booleanOptions(props)), metadataForNode(node));
                session.setCurrentNodeId(node.getClientNodeId());
            }
            case "QUEUE_ROUTING" -> {
                Long queueId = asLong(props.get("queueId"));
                if (queueId != null) {
                    session.setQueue(projectService.requireQueue(session.getProject().getId(), queueId));
                }
                followFirst(session, workflow, node);
            }
            case "ESCALATE_TO_AGENT" -> {
                Long queueId = asLong(props.get("queueId"));
                if (queueId != null) {
                    session.setQueue(projectService.requireQueue(session.getProject().getId(), queueId));
                }
                escalate(session);
            }
            case "END" -> {
                addMessage(session, "BOT", null, trimToDefault(asString(props.get("message")), "Thanks. This conversation is now closed."), "{}");
                session.setStatus("CLOSED");
                session.setClosedAt(LocalDateTime.now());
            }
            default -> followFirst(session, workflow, node);
        }
    }

    private void followFirst(LiveChatSession session, ChatWorkflow workflow, ChatWorkflowNode node) {
        List<ChatWorkflowConnection> outgoing = projectService.outgoing(workflow.getId(), node.getClientNodeId());
        if (outgoing.isEmpty()) {
            session.setCurrentNodeId(node.getClientNodeId());
            return;
        }
        ChatWorkflowNode next = findNode(workflow, outgoing.get(0).getTargetNodeId());
        if (next == null) return;
        session.setCurrentNodeId(next.getClientNodeId());
        visitNode(session, workflow, next, null);
    }

    private ChatWorkflowConnection selectConnection(ChatWorkflowNode node, List<ChatWorkflowConnection> edges, String customerMessage) {
        String normalized = trim(customerMessage).toLowerCase(Locale.ROOT);
        if (edges.isEmpty()) return null;
        if ("TEXT_ENTRY".equals(node.getType())) {
            return findByHandle(edges, "text").orElse(edges.get(0));
        }
        if ("BOOLEAN_RESPONSE".equals(node.getType())) {
            String bool = normalizeBoolean(normalized);
            if (bool == null) return null;
            return findByHandle(edges, bool)
                .or(() -> edges.stream().filter(edge -> trim(edge.getLabel()).equalsIgnoreCase(bool)).findFirst())
                .orElse(null);
        }
        for (ChatWorkflowConnection edge : edges) {
            String label = trim(edge.getLabel()).toLowerCase(Locale.ROOT);
            String handle = trim(edge.getSourceHandle()).toLowerCase(Locale.ROOT);
            if (!label.isBlank() && normalized.equals(label)) {
                return edge;
            }
            if (!handle.isBlank() && handle.startsWith("choice:") && handle.equals("choice:" + slug(normalized))) {
                return edge;
            }
        }
        return edges.size() == 1 ? edges.get(0) : null;
    }

    private Optional<ChatWorkflowConnection> findByHandle(List<ChatWorkflowConnection> edges, String handle) {
        return edges.stream()
            .filter(edge -> handle.equalsIgnoreCase(trim(edge.getSourceHandle())))
            .findFirst();
    }

    private String retryMessageFor(ChatWorkflowNode node) {
        Map<String, Object> props = projectService.fromJsonMap(node.getPropertiesJson());
        if ("BOOLEAN_RESPONSE".equals(node.getType())) {
            return appendOptions("Please choose one of these answers.", booleanOptions(props));
        }
        if ("CHOICE_RESPONSE".equals(node.getType()) || "QUESTION".equals(node.getType()) || "CHOICE".equals(node.getType())) {
            return appendOptions("Please choose one of the available options.", choiceOptions(props));
        }
        return "Please answer to continue.";
    }

    private String appendOptions(String message, List<String> options) {
        if (options.isEmpty()) return message;
        return message + "\n\nOptions: " + String.join(" / ", options);
    }

    private String metadataForNode(ChatWorkflowNode node) {
        Map<String, Object> props = projectService.fromJsonMap(node.getPropertiesJson());
        if ("BOOLEAN_RESPONSE".equals(node.getType())) {
            return toJson(Map.of("nodeType", node.getType(), "options", booleanOptions(props)));
        }
        if ("CHOICE_RESPONSE".equals(node.getType()) || "QUESTION".equals(node.getType()) || "CHOICE".equals(node.getType())) {
            return toJson(Map.of("nodeType", node.getType(), "options", choiceOptions(props)));
        }
        if ("TEXT_ENTRY".equals(node.getType())) {
            return toJson(Map.of("nodeType", node.getType(), "input", "text", "variableName", trimToDefault(asString(props.get("variableName")), "customer_input")));
        }
        return "{}";
    }

    private List<String> choiceOptions(Map<String, Object> props) {
        Object raw = props.get("choices");
        if (!(raw instanceof List<?> list)) return List.of();
        return list.stream()
            .map(value -> trim(asString(value)))
            .filter(value -> !value.isBlank())
            .toList();
    }

    private List<String> booleanOptions(Map<String, Object> props) {
        return List.of(
            trimToDefault(asString(props.get("yesLabel")), "Yes"),
            trimToDefault(asString(props.get("noLabel")), "No")
        );
    }

    private String normalizeBoolean(String value) {
        String normalized = trim(value).toLowerCase(Locale.ROOT);
        if (Set.of("yes", "y", "true", "1", "oui", "ok", "correct").contains(normalized)) return "yes";
        if (Set.of("no", "n", "false", "0", "non", "incorrect").contains(normalized)) return "no";
        return null;
    }

    private ChatWorkflowNode findNode(ChatWorkflow workflow, String clientNodeId) {
        return projectService.workflowNodes(workflow.getId()).stream()
            .filter(node -> Objects.equals(node.getClientNodeId(), clientNodeId))
            .findFirst()
            .orElse(null);
    }

    private void escalateToDefaultQueue(LiveChatSession session) {
        List<ChatQueue> queues = queueRepository.findByProjectIdAndArchivedFalseOrderByPriorityAscNameAsc(session.getProject().getId());
        if (!queues.isEmpty()) {
            session.setQueue(queues.get(0));
        }
        escalate(session);
    }

    private void escalate(LiveChatSession session) {
        session.setEscalatedAt(LocalDateTime.now());
        User agent = chooseAgent(session.getQueue());
        if (agent == null) {
            session.setStatus(session.getQueue() == null ? "WAITING_FOR_QUEUE" : "WAITING_FOR_AGENT");
            addMessage(session, "SYSTEM", null, "Conversation is waiting for an available agent.", "{}");
        } else {
            assignSession(session, agent);
            addMessage(session, "SYSTEM", agent, displayName(agent) + " was assigned automatically.", "{}");
        }
        sessionRepository.save(session);
    }

    private User chooseAgent(ChatQueue queue) {
        if (queue == null) return null;
        List<User> candidates = queueAgentRepository.findByQueueIdAndActiveTrue(queue.getId()).stream()
            .map(ChatQueueAgent::getUser)
            .filter(user -> Boolean.TRUE.equals(user.getActive()))
            .sorted(Comparator
                .comparing((User user) -> !"ONLINE".equalsIgnoreCase(trim(user.getStatus())))
                .thenComparing(user -> sessionRepository.countByAssignedAgentIdAndStatusIn(user.getId(), ACTIVE_STATUSES))
                .thenComparing(User::getId))
            .toList();
        return candidates.isEmpty() ? null : candidates.get(0);
    }

    private void assignSession(LiveChatSession session, User agent) {
        if (session.getAssignedAgent() != null && !Objects.equals(session.getAssignedAgent().getId(), agent.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This chat is already assigned.");
        }
        session.setAssignedAgent(agent);
        session.setStatus("ASSIGNED_TO_AGENT");
        sessionRepository.save(session);
        if (assignmentRepository.findBySessionIdAndActiveTrue(session.getId()).isEmpty()) {
            LiveChatAssignment assignment = new LiveChatAssignment();
            assignment.setSession(session);
            assignment.setAgent(agent);
            assignmentRepository.save(assignment);
        }
    }

    private LiveChatMessage addMessage(LiveChatSession session, String senderType, User sender, String body, String metadataJson) {
        LiveChatMessage message = new LiveChatMessage();
        message.setSession(session);
        message.setSenderType(senderType);
        message.setSenderUser(sender);
        message.setSenderName(sender == null ? senderType : displayName(sender));
        message.setBody(body);
        message.setMetadataJson(metadataJson);
        message = messageRepository.save(message);
        session.setLastMessagePreview(body.length() > 250 ? body.substring(0, 250) : body);
        sessionRepository.save(session);
        return message;
    }

    private void recordExecution(LiveChatSession session, String nodeId, String eventType, String payload) {
        WorkflowExecution row = new WorkflowExecution();
        row.setSession(session);
        row.setNodeId(nodeId);
        row.setEventType(eventType);
        row.setPayloadJson(payload);
        executionRepository.save(row);
    }

    private LiveChatSession requireSession(Long sessionId) {
        return sessionRepository.findById(sessionId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat session not found."));
    }

    private LiveChatSession requirePublicSession(String token) {
        LiveChatSession session = sessionRepository.findByPublicToken(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat session not found."));
        if (!Boolean.TRUE.equals(session.getProject().getPublicEnabled())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat session not available.");
        }
        return session;
    }

    private LiveChatSession requireVisibleSession(User user, Long sessionId) {
        LiveChatSession session = requireSession(sessionId);
        if (canSeeAll(user)) return session;
        if (session.getAssignedAgent() != null && Objects.equals(session.getAssignedAgent().getId(), user.getId())) return session;
        if (session.getQueue() != null && !queueAgentRepository.findByQueueProjectIdAndUserIdAndActiveTrue(session.getProject().getId(), user.getId()).isEmpty()) return session;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chat session is not visible to this account.");
    }

    public Map<String, Object> toSessionDto(LiveChatSession session) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", session.getId());
        dto.put("projectId", session.getProject().getId());
        dto.put("projectName", session.getProject().getName());
        dto.put("projectSlug", session.getProject().getSlug());
        dto.put("queueId", session.getQueue() == null ? null : session.getQueue().getId());
        dto.put("queueName", session.getQueue() == null ? null : session.getQueue().getName());
        dto.put("assignedAgentId", session.getAssignedAgent() == null ? null : session.getAssignedAgent().getId());
        dto.put("assignedAgentName", session.getAssignedAgent() == null ? null : displayName(session.getAssignedAgent()));
        dto.put("publicToken", session.getPublicToken());
        dto.put("customerName", session.getCustomerName());
        dto.put("customerEmail", session.getCustomerEmail());
        dto.put("status", session.getStatus());
        dto.put("currentNodeId", session.getCurrentNodeId());
        dto.put("lastMessagePreview", session.getLastMessagePreview());
        dto.put("unreadForAgent", session.getUnreadForAgent());
        dto.put("unreadForCustomer", session.getUnreadForCustomer());
        dto.put("createdAt", session.getCreatedAt());
        dto.put("updatedAt", session.getUpdatedAt());
        dto.put("escalatedAt", session.getEscalatedAt());
        dto.put("closedAt", session.getClosedAt());
        return dto;
    }

    private List<Map<String, Object>> messages(LiveChatSession session) {
        return messageRepository.findBySessionIdOrderByCreatedAtAscIdAsc(session.getId()).stream()
            .map(this::toMessageDto)
            .toList();
    }

    private Map<String, Object> toMessageDto(LiveChatMessage message) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", message.getId());
        dto.put("sessionId", message.getSession().getId());
        dto.put("senderType", message.getSenderType());
        dto.put("senderUserId", message.getSenderUser() == null ? null : message.getSenderUser().getId());
        dto.put("senderName", message.getSenderName());
        dto.put("body", message.getBody());
        dto.put("metadataJson", message.getMetadataJson());
        dto.put("createdAt", message.getCreatedAt());
        return dto;
    }

    private boolean canSeeAll(User user) {
        String role = normalizeRole(user == null ? null : user.getRole());
        return Set.of("ADMIN", "HEAD_CS", "OPS", "TEAM_LEADER", "QA").contains(role);
    }

    private boolean isAgentOnly(User user) {
        return !canSeeAll(user);
    }

    private String normalizeRole(String rawRole) {
        String role = trim(rawRole).toUpperCase(Locale.ROOT);
        if (role.startsWith("ROLE_")) role = role.substring("ROLE_".length());
        if (role.equals("HEAD_OF_CS")) return "HEAD_CS";
        if (role.equals("TL")) return "TEAM_LEADER";
        if (role.equals("QUALITY")) return "QA";
        if (role.equals("1")) return "ADMIN";
        if (role.equals("2")) return "AGENT";
        if (role.equals("3")) return "TEAM_LEADER";
        if (role.equals("4")) return "QA";
        if (role.equals("5")) return "HEAD_CS";
        if (role.equals("6")) return "OPS";
        return role;
    }

    private String displayName(User user) {
        return trim((user.getFirstName() + " " + user.getLastName()));
    }

    private String trim(String value) { return value == null ? "" : value.trim(); }
    private String trimToDefault(String value, String fallback) { String v = trim(value); return v.isBlank() ? fallback : v; }
    private String asString(Object value) { return value == null ? "" : String.valueOf(value); }
    private String blankToNull(String value) { String v = trim(value); return v.isBlank() ? null : v; }
    private Long asLong(Object value) {
        if (value instanceof Number n) return n.longValue();
        try { return Long.parseLong(trim(asString(value))); } catch (Exception ex) { return null; }
    }
    private int asInt(Object value) {
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(trim(asString(value))); } catch (Exception ex) { return 0; }
    }
    private Integer nullSafe(Integer value) { return value == null ? 0 : value; }
    private Object firstNonNull(Object a, Object b) { return a != null ? a : b; }
    private String truncate(String value, int maxLength) {
        String v = trim(value);
        return v.length() <= maxLength ? v : v.substring(0, maxLength);
    }

    private String slug(String value) {
        return trim(value).toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("(^-|-$)", "");
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (Exception ex) {
            return "{}";
        }
    }
}
