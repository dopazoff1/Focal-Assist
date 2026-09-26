package com.crdpls.api.service;

import com.crdpls.api.models.*;
import com.crdpls.api.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class ChatProjectService {
    private final ChatProjectRepository projectRepository;
    private final ChatProjectApiKeyRepository apiKeyRepository;
    private final ChatWorkflowRepository workflowRepository;
    private final ChatWorkflowNodeRepository nodeRepository;
    private final ChatWorkflowConnectionRepository connectionRepository;
    private final ChatQueueRepository queueRepository;
    private final ChatQueueAgentRepository queueAgentRepository;
    private final LiveChatMessageRepository messageRepository;
    private final LiveChatSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecureRandom secureRandom = new SecureRandom();

    public ChatProjectService(
        ChatProjectRepository projectRepository,
        ChatProjectApiKeyRepository apiKeyRepository,
        ChatWorkflowRepository workflowRepository,
        ChatWorkflowNodeRepository nodeRepository,
        ChatWorkflowConnectionRepository connectionRepository,
        ChatQueueRepository queueRepository,
        ChatQueueAgentRepository queueAgentRepository,
        LiveChatMessageRepository messageRepository,
        LiveChatSessionRepository sessionRepository,
        UserRepository userRepository
    ) {
        this.projectRepository = projectRepository;
        this.apiKeyRepository = apiKeyRepository;
        this.workflowRepository = workflowRepository;
        this.nodeRepository = nodeRepository;
        this.connectionRepository = connectionRepository;
        this.queueRepository = queueRepository;
        this.queueAgentRepository = queueAgentRepository;
        this.messageRepository = messageRepository;
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
    }

    public List<Map<String, Object>> listProjects(String search) {
        String term = trim(search).toLowerCase(Locale.ROOT);
        return projectRepository.findAllByOrderByUpdatedAtDesc().stream()
            .filter(project -> term.isBlank()
                || trim(project.getName()).toLowerCase(Locale.ROOT).contains(term)
                || trim(project.getSlug()).toLowerCase(Locale.ROOT).contains(term)
                || trim(project.getDescription()).toLowerCase(Locale.ROOT).contains(term))
            .map(this::toProjectDto)
            .toList();
    }

    public List<Map<String, Object>> listAssignableUsers() {
        return userRepository.findAll().stream()
            .filter(user -> Boolean.TRUE.equals(user.getActive()))
            .sorted(Comparator.comparing(User::getFirstName, Comparator.nullsLast(String::compareToIgnoreCase))
                .thenComparing(User::getLastName, Comparator.nullsLast(String::compareToIgnoreCase))
                .thenComparing(User::getId))
            .map(this::userDto)
            .toList();
    }

    public Map<String, Object> getProject(Long projectId) {
        ChatProject project = requireProject(projectId);
        Map<String, Object> dto = toProjectDto(project);
        dto.put("queues", listQueues(projectId));
        dto.put("apiKeys", listApiKeys(projectId));
        dto.put("workflow", getWorkflow(projectId));
        return dto;
    }

    public Map<String, Object> createProject(Map<String, Object> request) {
        String name = trim(asString(request.get("name")));
        if (name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project name is required.");
        }
        ChatProject project = new ChatProject();
        project.setName(name);
        project.setSlug(uniqueSlug(asString(request.get("slug")), name));
        project.setDescription(trim(asString(request.get("description"))));
        project.setStatus(normalizeProjectStatus(asString(request.get("status")), "DRAFT"));
        project.setBrandColor(trimToDefault(asString(request.get("brandColor")), "#3157ff"));
        project.setWelcomeMessage(trimToDefault(asString(request.get("welcomeMessage")), "Hi. How can we help?"));
        project.setPublicEnabled(!Boolean.FALSE.equals(asBoolean(request.get("publicEnabled"))));
        ChatProject saved = projectRepository.save(project);
        ensureDefaultQueue(saved);
        return getProject(saved.getId());
    }

    public Map<String, Object> updateProject(Long projectId, Map<String, Object> request) {
        ChatProject project = requireProject(projectId);
        if (request.containsKey("name")) {
            String name = trim(asString(request.get("name")));
            if (name.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project name is required.");
            project.setName(name);
        }
        if (request.containsKey("slug")) {
            String requested = slugify(asString(request.get("slug")));
            if (requested.isBlank()) requested = slugify(project.getName());
            if (!requested.equals(project.getSlug()) && projectRepository.existsBySlug(requested)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Project slug already exists.");
            }
            project.setSlug(requested);
        }
        if (request.containsKey("description")) project.setDescription(trim(asString(request.get("description"))));
        if (request.containsKey("status")) project.setStatus(normalizeProjectStatus(asString(request.get("status")), project.getStatus()));
        if (request.containsKey("brandColor")) project.setBrandColor(trimToDefault(asString(request.get("brandColor")), "#3157ff"));
        if (request.containsKey("welcomeMessage")) project.setWelcomeMessage(trimToDefault(asString(request.get("welcomeMessage")), "Hi. How can we help?"));
        if (request.containsKey("publicEnabled")) project.setPublicEnabled(!Boolean.FALSE.equals(asBoolean(request.get("publicEnabled"))));
        projectRepository.save(project);
        return getProject(projectId);
    }

    public Map<String, Object> setProjectStatus(Long projectId, String status) {
        ChatProject project = requireProject(projectId);
        project.setStatus(normalizeProjectStatus(status, project.getStatus()));
        projectRepository.save(project);
        return toProjectDto(project);
    }

    public Map<String, Object> duplicateProject(Long projectId) {
        ChatProject source = requireProject(projectId);
        ChatProject copy = new ChatProject();
        copy.setName(source.getName() + " Copy");
        copy.setSlug(uniqueSlug(null, copy.getName()));
        copy.setDescription(source.getDescription());
        copy.setStatus("DRAFT");
        copy.setBrandColor(source.getBrandColor());
        copy.setWelcomeMessage(source.getWelcomeMessage());
        copy.setPublicEnabled(false);
        copy = projectRepository.save(copy);

        for (ChatQueue queue : queueRepository.findByProjectIdOrderByPriorityAscNameAsc(source.getId())) {
            ChatQueue clone = new ChatQueue();
            clone.setProject(copy);
            clone.setName(queue.getName());
            clone.setDescription(queue.getDescription());
            clone.setColor(queue.getColor());
            clone.setPriority(queue.getPriority());
            clone.setArchived(queue.getArchived());
            queueRepository.save(clone);
        }

        Optional<ChatWorkflow> sourceWorkflow = workflowRepository.findFirstByProjectIdAndStatusOrderByVersionDesc(source.getId(), "ACTIVE")
            .or(() -> workflowRepository.findFirstByProjectIdOrderByVersionDesc(source.getId()));
        if (sourceWorkflow.isPresent()) {
            ChatWorkflow wf = new ChatWorkflow();
            wf.setProject(copy);
            wf.setStatus("DRAFT");
            wf.setVersion(1);
            wf = workflowRepository.save(wf);
            for (ChatWorkflowNode node : nodeRepository.findByWorkflowIdOrderByIdAsc(sourceWorkflow.get().getId())) {
                ChatWorkflowNode clone = new ChatWorkflowNode();
                clone.setWorkflow(wf);
                clone.setClientNodeId(node.getClientNodeId());
                clone.setType(node.getType());
                clone.setTitle(node.getTitle());
                clone.setX(node.getX());
                clone.setY(node.getY());
                clone.setPropertiesJson(node.getPropertiesJson());
                nodeRepository.save(clone);
            }
            for (ChatWorkflowConnection edge : connectionRepository.findByWorkflowIdOrderByIdAsc(sourceWorkflow.get().getId())) {
                ChatWorkflowConnection clone = new ChatWorkflowConnection();
                clone.setWorkflow(wf);
                clone.setSourceNodeId(edge.getSourceNodeId());
                clone.setTargetNodeId(edge.getTargetNodeId());
                clone.setLabel(edge.getLabel());
                clone.setSourceHandle(edge.getSourceHandle());
                clone.setTargetHandle(edge.getTargetHandle());
                connectionRepository.save(clone);
            }
        }
        return getProject(copy.getId());
    }

    public void deleteProject(Long projectId) {
        ChatProject project = requireProject(projectId);
        messageRepository.deleteBySessionProjectId(projectId);
        sessionRepository.deleteAll(sessionRepository.findByProjectIdOrderByUpdatedAtDesc(projectId));
        apiKeyRepository.deleteByProjectId(projectId);
        for (ChatQueue queue : queueRepository.findByProjectIdOrderByPriorityAscNameAsc(projectId)) {
            queueAgentRepository.deleteByQueueId(queue.getId());
        }
        queueRepository.deleteByProjectId(projectId);
        for (ChatWorkflow workflow : workflowRepository.findByProjectIdOrderByVersionDesc(projectId)) {
            connectionRepository.deleteByWorkflowId(workflow.getId());
            nodeRepository.deleteByWorkflowId(workflow.getId());
        }
        workflowRepository.deleteByProjectId(projectId);
        projectRepository.delete(project);
    }

    public List<Map<String, Object>> listApiKeys(Long projectId) {
        requireProject(projectId);
        return apiKeyRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
            .map(this::toApiKeyDto)
            .toList();
    }

    public Map<String, Object> rotateApiKey(Long projectId) {
        ChatProject project = requireProject(projectId);
        String raw = "ka_live_" + randomToken(38);
        ChatProjectApiKey key = new ChatProjectApiKey();
        key.setProject(project);
        key.setTokenHash(sha256(raw));
        key.setTokenPreview(raw.substring(0, 12) + "..." + raw.substring(raw.length() - 6));
        key = apiKeyRepository.save(key);
        Map<String, Object> dto = toApiKeyDto(key);
        dto.put("token", raw);
        return dto;
    }

    public void revokeApiKey(Long projectId, Long keyId) {
        requireProject(projectId);
        ChatProjectApiKey key = apiKeyRepository.findById(keyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "API key not found."));
        if (!Objects.equals(key.getProject().getId(), projectId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "API key not found for project.");
        }
        key.setActive(false);
        apiKeyRepository.save(key);
    }

    public Map<String, Object> getWorkflow(Long projectId) {
        requireProject(projectId);
        ChatWorkflow workflow = workflowRepository.findFirstByProjectIdOrderByVersionDesc(projectId).orElse(null);
        if (workflow == null) {
            return emptyWorkflowDto(projectId);
        }
        return toWorkflowDto(workflow);
    }

    public Map<String, Object> saveWorkflow(Long projectId, Map<String, Object> request) {
        ChatProject project = requireProject(projectId);
        ChatWorkflow workflow = workflowRepository.findFirstByProjectIdOrderByVersionDesc(projectId).orElse(null);
        if (workflow == null) {
            workflow = new ChatWorkflow();
            workflow.setProject(project);
            workflow.setStatus("DRAFT");
            workflow.setVersion(1);
            workflow = workflowRepository.save(workflow);
        } else if ("ACTIVE".equalsIgnoreCase(workflow.getStatus())) {
            ChatWorkflow draft = new ChatWorkflow();
            draft.setProject(project);
            draft.setStatus("DRAFT");
            draft.setVersion((workflow.getVersion() == null ? 1 : workflow.getVersion()) + 1);
            workflow = workflowRepository.save(draft);
        } else {
            workflow.setStatus("DRAFT");
            workflowRepository.save(workflow);
        }

        connectionRepository.deleteByWorkflowId(workflow.getId());
        nodeRepository.deleteByWorkflowId(workflow.getId());

        List<Map<String, Object>> nodes = asMapList(request.get("nodes"));
        List<Map<String, Object>> connections = asMapList(request.get("connections"));
        if (nodes.isEmpty()) {
            nodes = List.of(Map.of(
                "clientNodeId", "start",
                "type", "START",
                "title", "Start",
                "x", 220,
                "y", 260,
                "properties", Map.of("message", project.getWelcomeMessage())
            ));
        }
        for (Map<String, Object> nodeReq : nodes) {
            ChatWorkflowNode node = new ChatWorkflowNode();
            node.setWorkflow(workflow);
            node.setClientNodeId(trimToDefault(asString(firstNonNull(nodeReq.get("clientNodeId"), nodeReq.get("id"))), "node-" + UUID.randomUUID()));
            node.setType(normalizeNodeType(asString(nodeReq.get("type"))));
            node.setTitle(trimToDefault(asString(nodeReq.get("title")), node.getType()));
            node.setX(asDouble(firstNonNull(nodeReq.get("x"), nodeReq.get("xPos")), 0d));
            node.setY(asDouble(firstNonNull(nodeReq.get("y"), nodeReq.get("yPos")), 0d));
            node.setPropertiesJson(toJson(firstNonNull(nodeReq.get("properties"), nodeReq.get("propertiesJson"))));
            nodeRepository.save(node);
        }
        for (Map<String, Object> edgeReq : connections) {
            String source = trim(asString(firstNonNull(edgeReq.get("sourceNodeId"), edgeReq.get("source"))));
            String target = trim(asString(firstNonNull(edgeReq.get("targetNodeId"), edgeReq.get("target"))));
            if (source.isBlank() || target.isBlank()) continue;
            ChatWorkflowConnection edge = new ChatWorkflowConnection();
            edge.setWorkflow(workflow);
            edge.setSourceNodeId(source);
            edge.setTargetNodeId(target);
            edge.setLabel(trim(asString(edgeReq.get("label"))));
            edge.setSourceHandle(trim(asString(edgeReq.get("sourceHandle"))));
            edge.setTargetHandle(trim(asString(edgeReq.get("targetHandle"))));
            connectionRepository.save(edge);
        }
        return toWorkflowDto(workflow);
    }

    public Map<String, Object> publishWorkflow(Long projectId) {
        requireProject(projectId);
        ChatWorkflow workflow = workflowRepository.findFirstByProjectIdOrderByVersionDesc(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No workflow draft exists."));
        if (nodeRepository.findByWorkflowIdOrderByIdAsc(workflow.getId()).stream().noneMatch(node -> "START".equals(node.getType()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workflow must contain a Start node before publishing.");
        }
        validateWorkflowRouting(workflow);
        workflow.setStatus("ACTIVE");
        workflow.setPublishedAt(LocalDateTime.now());
        workflowRepository.save(workflow);
        return toWorkflowDto(workflow);
    }

    public List<Map<String, Object>> listQueues(Long projectId) {
        requireProject(projectId);
        return queueRepository.findByProjectIdOrderByPriorityAscNameAsc(projectId).stream()
            .map(this::toQueueDto)
            .toList();
    }

    public Map<String, Object> saveQueue(Long projectId, Long queueId, Map<String, Object> request) {
        ChatProject project = requireProject(projectId);
        ChatQueue queue = queueId == null ? new ChatQueue() : requireQueue(projectId, queueId);
        queue.setProject(project);
        queue.setName(trimToDefault(asString(request.get("name")), "Support"));
        queue.setDescription(trim(asString(request.get("description"))));
        queue.setColor(trimToDefault(asString(request.get("color")), "#3157ff"));
        queue.setPriority(asInteger(request.get("priority"), 0));
        if (request.containsKey("archived")) queue.setArchived(Boolean.TRUE.equals(asBoolean(request.get("archived"))));
        queue = queueRepository.save(queue);
        return toQueueDto(queue);
    }

    public void archiveQueue(Long projectId, Long queueId) {
        ChatQueue queue = requireQueue(projectId, queueId);
        queue.setArchived(true);
        queueRepository.save(queue);
    }

    public Map<String, Object> replaceQueueAgents(Long projectId, Long queueId, Map<String, Object> request) {
        ChatQueue queue = requireQueue(projectId, queueId);
        Set<Long> wantedIds = asLongList(request.get("agentIds")).stream()
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        for (Long userId : wantedIds) {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agent not found: " + userId));
            ChatQueueAgent membership = queueAgentRepository.findByQueueIdAndUserId(queueId, userId).orElse(null);
            if (membership == null) {
                membership = new ChatQueueAgent();
                membership.setQueue(queue);
                membership.setUser(user);
            }
            membership.setActive(true);
            queueAgentRepository.save(membership);
        }
        for (ChatQueueAgent existing : queueAgentRepository.findByQueueIdAndActiveTrue(queueId)) {
            if (!wantedIds.contains(existing.getUser().getId())) {
                existing.setActive(false);
                queueAgentRepository.save(existing);
            }
        }
        return toQueueDto(queue);
    }

    public ChatProject requireProject(Long projectId) {
        if (projectId == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project id is required.");
        return projectRepository.findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat project not found."));
    }

    public ChatProject requirePublicProject(String slug) {
        ChatProject project = projectRepository.findBySlug(slug)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat project not found."));
        if (!Boolean.TRUE.equals(project.getPublicEnabled()) || "ARCHIVED".equalsIgnoreCase(project.getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat project is not public.");
        }
        return project;
    }

    public Optional<ChatProjectApiKey> validateApiKey(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return Optional.empty();
        Optional<ChatProjectApiKey> key = apiKeyRepository.findByTokenHashAndActiveTrue(sha256(rawToken.trim()));
        key.ifPresent(row -> {
            row.setLastUsedAt(LocalDateTime.now());
            apiKeyRepository.save(row);
        });
        return key;
    }

    public ChatQueue requireQueue(Long projectId, Long queueId) {
        ChatQueue queue = queueRepository.findById(queueId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Queue not found."));
        if (!Objects.equals(queue.getProject().getId(), projectId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Queue not found for project.");
        }
        return queue;
    }

    public Optional<ChatWorkflow> activeWorkflow(Long projectId) {
        return workflowRepository.findFirstByProjectIdAndStatusOrderByVersionDesc(projectId, "ACTIVE")
            .or(() -> workflowRepository.findFirstByProjectIdOrderByVersionDesc(projectId));
    }

    public List<ChatWorkflowNode> workflowNodes(Long workflowId) {
        return nodeRepository.findByWorkflowIdOrderByIdAsc(workflowId);
    }

    public List<ChatWorkflowConnection> workflowConnections(Long workflowId) {
        return connectionRepository.findByWorkflowIdOrderByIdAsc(workflowId);
    }

    public List<ChatWorkflowConnection> outgoing(Long workflowId, String sourceNodeId) {
        return connectionRepository.findByWorkflowIdAndSourceNodeIdOrderByIdAsc(workflowId, sourceNodeId);
    }

    public Map<String, Object> toProjectDto(ChatProject project) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", project.getId());
        dto.put("name", project.getName());
        dto.put("slug", project.getSlug());
        dto.put("description", project.getDescription());
        dto.put("status", project.getStatus());
        dto.put("brandColor", project.getBrandColor());
        dto.put("welcomeMessage", project.getWelcomeMessage());
        dto.put("publicEnabled", project.getPublicEnabled());
        dto.put("publicUrl", "/chat/" + project.getSlug());
        dto.put("createdAt", project.getCreatedAt());
        dto.put("updatedAt", project.getUpdatedAt());
        return dto;
    }

    public Map<String, Object> toQueueDto(ChatQueue queue) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", queue.getId());
        dto.put("projectId", queue.getProject().getId());
        dto.put("name", queue.getName());
        dto.put("description", queue.getDescription());
        dto.put("color", queue.getColor());
        dto.put("priority", queue.getPriority());
        dto.put("archived", queue.getArchived());
        List<Map<String, Object>> agents = queueAgentRepository.findByQueueIdAndActiveTrue(queue.getId()).stream()
            .map(row -> userDto(row.getUser()))
            .toList();
        dto.put("agents", agents);
        dto.put("agentIds", agents.stream().map(agent -> agent.get("id")).toList());
        dto.put("createdAt", queue.getCreatedAt());
        dto.put("updatedAt", queue.getUpdatedAt());
        return dto;
    }

    public Map<String, Object> userDto(User user) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", user.getId());
        dto.put("name", trim((user.getFirstName() + " " + user.getLastName())));
        dto.put("email", user.getEmail());
        dto.put("role", user.getRole());
        dto.put("status", user.getStatus());
        dto.put("active", user.getActive());
        return dto;
    }

    private void ensureDefaultQueue(ChatProject project) {
        if (!queueRepository.findByProjectIdOrderByPriorityAscNameAsc(project.getId()).isEmpty()) return;
        ChatQueue queue = new ChatQueue();
        queue.setProject(project);
        queue.setName("Support");
        queue.setDescription("Default support queue");
        queue.setColor(project.getBrandColor());
        queue.setPriority(1);
        queueRepository.save(queue);
    }

    private Map<String, Object> toApiKeyDto(ChatProjectApiKey key) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", key.getId());
        dto.put("projectId", key.getProject().getId());
        dto.put("tokenPreview", key.getTokenPreview());
        dto.put("active", key.getActive());
        dto.put("createdAt", key.getCreatedAt());
        dto.put("lastUsedAt", key.getLastUsedAt());
        return dto;
    }

    private Map<String, Object> emptyWorkflowDto(Long projectId) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", null);
        dto.put("projectId", projectId);
        dto.put("status", "DRAFT");
        dto.put("version", 1);
        dto.put("nodes", List.of());
        dto.put("connections", List.of());
        return dto;
    }

    public Map<String, Object> toWorkflowDto(ChatWorkflow workflow) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", workflow.getId());
        dto.put("projectId", workflow.getProject().getId());
        dto.put("status", workflow.getStatus());
        dto.put("version", workflow.getVersion());
        dto.put("publishedAt", workflow.getPublishedAt());
        dto.put("updatedAt", workflow.getUpdatedAt());
        dto.put("nodes", nodeRepository.findByWorkflowIdOrderByIdAsc(workflow.getId()).stream().map(this::toNodeDto).toList());
        dto.put("connections", connectionRepository.findByWorkflowIdOrderByIdAsc(workflow.getId()).stream().map(this::toConnectionDto).toList());
        return dto;
    }

    public Map<String, Object> toNodeDto(ChatWorkflowNode node) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", node.getId());
        dto.put("clientNodeId", node.getClientNodeId());
        dto.put("type", node.getType());
        dto.put("title", node.getTitle());
        dto.put("x", node.getX());
        dto.put("y", node.getY());
        dto.put("properties", fromJsonMap(node.getPropertiesJson()));
        return dto;
    }

    public Map<String, Object> toConnectionDto(ChatWorkflowConnection edge) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", edge.getId());
        dto.put("sourceNodeId", edge.getSourceNodeId());
        dto.put("targetNodeId", edge.getTargetNodeId());
        dto.put("label", edge.getLabel());
        dto.put("sourceHandle", edge.getSourceHandle());
        dto.put("targetHandle", edge.getTargetHandle());
        return dto;
    }

    private void validateWorkflowRouting(ChatWorkflow workflow) {
        List<ChatWorkflowNode> nodes = nodeRepository.findByWorkflowIdOrderByIdAsc(workflow.getId());
        List<ChatWorkflowConnection> edges = connectionRepository.findByWorkflowIdOrderByIdAsc(workflow.getId());
        Set<String> nodeIds = nodes.stream().map(ChatWorkflowNode::getClientNodeId).collect(Collectors.toSet());
        for (ChatWorkflowConnection edge : edges) {
            if (!nodeIds.contains(edge.getSourceNodeId()) || !nodeIds.contains(edge.getTargetNodeId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workflow contains a broken connector.");
            }
        }
        for (ChatWorkflowNode node : nodes) {
            if ("ESCALATE_TO_AGENT".equals(node.getType()) || "QUEUE_ROUTING".equals(node.getType())) {
                Map<String, Object> props = fromJsonMap(node.getPropertiesJson());
                Long queueId = asLong(props.get("queueId"));
                if (queueId == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Every escalation/queue node must point to a queue.");
                }
                ChatQueue queue = requireQueue(workflow.getProject().getId(), queueId);
                if (queueAgentRepository.findByQueueIdAndActiveTrue(queue.getId()).isEmpty()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Queue \"" + queue.getName() + "\" has no assigned agents.");
                }
            }
        }
    }

    private String uniqueSlug(String rawSlug, String name) {
        String base = slugify(trimToDefault(rawSlug, name));
        if (base.isBlank()) base = "chat-project";
        String candidate = base;
        int counter = 2;
        while (projectRepository.existsBySlug(candidate)) {
            candidate = base + "-" + counter++;
        }
        return candidate;
    }

    private String slugify(String value) {
        String out = trim(value).toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("(^-|-$)", "");
        return out.length() > 170 ? out.substring(0, 170).replaceAll("-$", "") : out;
    }

    private String normalizeProjectStatus(String raw, String fallback) {
        String status = trim(raw).toUpperCase(Locale.ROOT);
        if (Set.of("DRAFT", "ACTIVE", "ARCHIVED").contains(status)) return status;
        return trimToDefault(fallback, "DRAFT").toUpperCase(Locale.ROOT);
    }

    private String normalizeNodeType(String raw) {
        String type = trim(raw).toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        return switch (type) {
            case "START", "MESSAGE", "QUESTION", "CHOICE", "CHOICE_RESPONSE", "TEXT_ENTRY", "BOOLEAN_RESPONSE", "CONDITION", "VARIABLE", "API_CALL", "QUEUE_ROUTING", "ESCALATE_TO_AGENT", "END" -> type;
            case "ESCALATE" -> "ESCALATE_TO_AGENT";
            case "QUEUE" -> "QUEUE_ROUTING";
            case "BOT_CHOICES", "BOT_CHOICE", "CHOICES" -> "CHOICE_RESPONSE";
            case "TEXT", "TEXT_INPUT", "BOT_TEXT_ENTRY" -> "TEXT_ENTRY";
            case "BOOLEAN", "BOOL", "YES_NO", "BOT_BOOLEAN" -> "BOOLEAN_RESPONSE";
            default -> "MESSAGE";
        };
    }

    private String randomToken(int bytes) {
        byte[] data = new byte[bytes];
        secureRandom.nextBytes(data);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }

    private String sha256(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to hash token", ex);
        }
    }

    private String toJson(Object value) {
        try {
            if (value == null) return "{}";
            if (value instanceof String str) {
                String trimmed = str.trim();
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
            }
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return "{}";
        }
    }

    public Map<String, Object> fromJsonMap(String json) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception ex) {
            return new LinkedHashMap<>();
        }
    }

    private List<Map<String, Object>> asMapList(Object value) {
        if (!(value instanceof List<?> list)) return new ArrayList<>();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                Map<String, Object> normalized = new LinkedHashMap<>();
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    normalized.put(String.valueOf(entry.getKey()), entry.getValue());
                }
                out.add(normalized);
            }
        }
        return out;
    }

    private List<Long> asLongList(Object value) {
        if (!(value instanceof List<?> list)) return new ArrayList<>();
        return list.stream().map(this::asLong).filter(Objects::nonNull).toList();
    }

    private Object firstNonNull(Object a, Object b) { return a != null ? a : b; }
    private String trim(String value) { return value == null ? "" : value.trim(); }
    private String trimToDefault(String value, String fallback) { String v = trim(value); return v.isBlank() ? fallback : v; }
    private String asString(Object value) { return value == null ? "" : String.valueOf(value); }
    private Long asLong(Object value) {
        if (value instanceof Number n) return n.longValue();
        String str = trim(asString(value));
        if (str.isBlank()) return null;
        try { return Long.parseLong(str); } catch (Exception ex) { return null; }
    }
    private Integer asInteger(Object value, Integer fallback) {
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(trim(asString(value))); } catch (Exception ex) { return fallback; }
    }
    private Double asDouble(Object value, Double fallback) {
        if (value instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(trim(asString(value))); } catch (Exception ex) { return fallback; }
    }
    private Boolean asBoolean(Object value) {
        if (value instanceof Boolean b) return b;
        String str = trim(asString(value));
        if (str.isBlank()) return null;
        return Boolean.parseBoolean(str);
    }
}
