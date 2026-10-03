package com.focal.api.service;

import com.focal.api.dto.CrmCaseDto;
import com.focal.api.dto.CrmQueueGroupDto;
import com.focal.api.dto.CrmTicketUpdateRequestDto;
import com.focal.api.dto.MyPlaylistResponseDto;
import com.focal.api.dto.QaEvaluationCreateRequestDto;
import com.focal.api.dto.QaEvaluationDto;
import com.focal.api.models.CaseTagNode;
import com.focal.api.models.CemContact;
import com.focal.api.models.CemConversation;
import com.focal.api.models.CemInternalNote;
import com.focal.api.models.QaEvaluation;
import com.focal.api.models.User;
import com.focal.api.repository.CaseTagNodeRepository;
import com.focal.api.repository.CemInternalNoteRepository;
import com.focal.api.repository.CemConversationRepository;
import com.focal.api.repository.QaEvaluationRepository;
import com.focal.api.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class CrmService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final CemConversationRepository conversationRepository;
    private final CemInternalNoteRepository internalNoteRepository;
    private final CaseTagNodeRepository caseTagNodeRepository;
    private final UserRepository userRepository;
    private final QaEvaluationRepository qaEvaluationRepository;

    public CrmService(
        CemConversationRepository conversationRepository,
        CemInternalNoteRepository internalNoteRepository,
        CaseTagNodeRepository caseTagNodeRepository,
        UserRepository userRepository,
        QaEvaluationRepository qaEvaluationRepository
    ) {
        this.conversationRepository = conversationRepository;
        this.internalNoteRepository = internalNoteRepository;
        this.caseTagNodeRepository = caseTagNodeRepository;
        this.userRepository = userRepository;
        this.qaEvaluationRepository = qaEvaluationRepository;
    }

    @Transactional
    public MyPlaylistResponseDto getMyPlaylist(Long userId) {
        ensureUserExists(userId);
        ensurePlaylistAssignment(userId);
        return loadMyPlaylist(userId);
    }

    @Transactional
    public MyPlaylistResponseDto submitAndAssignNext(Long userId, Long conversationId, CrmTicketUpdateRequestDto request) {
        ensureUserExists(userId);
        CemConversation conversation = conversationRepository.findByIdAndAssignedUserId(conversationId, userId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Ticket not found for this user"));

        applyTicketUpdate(conversation, request);
        conversationRepository.save(conversation);

        ensurePlaylistAssignment(userId);
        return loadMyPlaylist(userId);
    }

    @Transactional
    public CrmCaseDto updateAssignedCase(Long userId, Long conversationId, CrmTicketUpdateRequestDto request) {
        ensureUserExists(userId);
        CemConversation conversation = conversationRepository.findByIdAndAssignedUserId(conversationId, userId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Ticket not found for this user"));

        applyTicketUpdate(conversation, request);
        conversationRepository.save(conversation);
        return toDto(conversation);
    }

    private MyPlaylistResponseDto loadMyPlaylist(Long userId) {
        List<CemConversation> conversations = conversationRepository.findMyPlaylistCases(userId);

        List<CrmCaseDto> mappedCases = conversations.stream()
            .map(this::toDto)
            .toList();

        MyPlaylistResponseDto response = new MyPlaylistResponseDto();
        response.setCases(mappedCases);
        response.setOldestCase(mappedCases.isEmpty() ? null : mappedCases.get(0));
        return response;
    }

    public List<CrmQueueGroupDto> getOpenCases(Long userId) {
        List<CemConversation> openCases = conversationRepository.findOpenCasesAssigned(userId);

        Map<String, List<CrmCaseDto>> grouped = new LinkedHashMap<>();
        for (CemConversation conversation : openCases) {
            String queueName = valueOrDefault(conversation.getQueueName(), "General Queue");
            grouped.computeIfAbsent(queueName, q -> new ArrayList<>()).add(toDto(conversation));
        }

        List<CrmQueueGroupDto> result = new ArrayList<>();
        grouped.forEach((queueName, tickets) -> {
            CrmQueueGroupDto group = new CrmQueueGroupDto();
            group.setQueueName(queueName);
            group.setTickets(tickets);
            result.add(group);
        });

        return result;
    }

    public List<CrmCaseDto> getAllCases() {
        User me = getCurrentUserOrThrow();
        String role = normalizeRole(me.getRole());
        List<CemConversation> conversations;
        if ("AGENT".equals(role)) {
            conversations = conversationRepository.findAllByAssignedUserIdOrderByUpdatedAtDesc(me.getId());
        } else {
            conversations = conversationRepository.findAllByOrderByUpdatedAtDesc();
        }
        return conversations.stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<QaEvaluationDto> getVisibleEvaluations() {
        User me = getCurrentUserOrThrow();
        String role = normalizeRole(me.getRole());
        List<QaEvaluation> evaluations;
        if ("AGENT".equals(role)) {
            evaluations = qaEvaluationRepository.findByEvaluatedUserIdOrderByCreatedAtDesc(me.getId());
        } else {
            evaluations = qaEvaluationRepository.findAllByOrderByCreatedAtDesc();
        }
        return evaluations.stream().map(this::toQaDto).toList();
    }

    @Transactional(readOnly = true)
    public List<QaEvaluationDto> getVisibleEvaluationsForConversation(Long conversationId) {
        User me = getCurrentUserOrThrow();
        String role = normalizeRole(me.getRole());
        List<QaEvaluation> evaluations = qaEvaluationRepository.findByConversationIdOrderByCreatedAtDesc(conversationId);
        if ("AGENT".equals(role)) {
            evaluations = evaluations.stream()
                .filter(e -> e.getEvaluatedUser() != null && me.getId().equals(e.getEvaluatedUser().getId()))
                .toList();
        }
        return evaluations.stream().map(this::toQaDto).toList();
    }

    @Transactional
    public QaEvaluationDto createEvaluation(QaEvaluationCreateRequestDto request) {
        User me = getCurrentUserOrThrow();
        String role = normalizeRole(me.getRole());
        if (!"QA".equals(role) && !"ADMIN".equals(role) && !"HEAD_CS".equals(role)) {
            throw new ResponseStatusException(BAD_REQUEST, "Only QA/Admin/Head CS can create evaluations");
        }
        if (request == null || request.getConversationId() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "conversationId is required");
        }
        if (request.getScore() == null || request.getScore() < 0 || request.getScore() > 100) {
            throw new ResponseStatusException(BAD_REQUEST, "score must be between 0 and 100");
        }

        CemConversation conversation = conversationRepository.findById(request.getConversationId())
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Conversation not found"));

        Long evaluatedUserId = request.getEvaluatedUserId();
        if (evaluatedUserId == null && conversation.getAssignedUser() != null) {
            evaluatedUserId = conversation.getAssignedUser().getId();
        }
        if (evaluatedUserId == null) {
            throw new ResponseStatusException(BAD_REQUEST, "evaluatedUserId is required when case is unassigned");
        }

        User evaluatedUser = userRepository.findById(evaluatedUserId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Evaluated user not found"));

        QaEvaluation evaluation = new QaEvaluation();
        evaluation.setConversation(conversation);
        evaluation.setEvaluatedUser(evaluatedUser);
        evaluation.setEvaluatorUser(me);
        evaluation.setScore(request.getScore());
        evaluation.setStrengths(request.getStrengths());
        evaluation.setImprovements(request.getImprovements());
        evaluation.setComment(request.getComment());

        return toQaDto(qaEvaluationRepository.save(evaluation));
    }

    @Transactional
    public Map<String, Object> addInternalNote(Long userId, Long conversationId, String note) {
        ensureUserExists(userId);
        if (note == null || note.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "note is required");
        }

        CemConversation conversation = conversationRepository.findByIdAndAssignedUserId(conversationId, userId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Ticket not found for this user"));
        User author = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User not found"));

        CemInternalNote internalNote = new CemInternalNote();
        internalNote.setConversation(conversation);
        internalNote.setCreatedByUser(author);
        internalNote.setNoteBody(note.trim());
        CemInternalNote saved = internalNoteRepository.save(internalNote);

        conversation.setLastMessageAt(LocalDateTime.now());
        conversationRepository.save(conversation);

        String authorName = userDisplayName(author);
        String createdAt = saved.getCreatedAt() != null
            ? saved.getCreatedAt().format(DATE_TIME_FORMATTER)
            : LocalDateTime.now().format(DATE_TIME_FORMATTER);

        Map<String, Object> message = new LinkedHashMap<>();
        message.put("id", "note-" + saved.getId());
        message.put("from", authorName);
        message.put("to", "Internal");
        message.put("subject", "Internal Note");
        message.put("date", createdAt);
        message.put("body", noteToHtml(saved.getNoteBody()));
        message.put("internalNote", true);
        message.put("attachments", List.of());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("saved", true);
        response.put("message", message);
        return response;
    }

    private void ensurePlaylistAssignment(Long userId) {
        List<CemConversation> alreadyAssigned = conversationRepository.findMyPlaylistCases(userId);
        if (!alreadyAssigned.isEmpty()) {
            return;
        }

        conversationRepository.assignOldestUnassignedToUser(userId);
    }

    private void applyTicketUpdate(CemConversation conversation, CrmTicketUpdateRequestDto request) {
        if (request == null || request.getStatus() == null || request.getStatus().isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Status is required");
        }

        conversation.setStatus(request.getStatus().trim().toLowerCase());
        if (request.getReply() != null && !request.getReply().isBlank()) {
            // We keep the reply in Gmail; here we just stamp activity on the conversation.
            conversation.setLastMessageAt(LocalDateTime.now());
        }

        if (request.getTagNodeIds() != null) {
            applyCaseTags(conversation, request.getTagNodeIds());
        }
    }

    private void applyCaseTags(CemConversation conversation, List<Long> tagNodeIds) {
        List<Long> normalizedTagIds = tagNodeIds.stream()
            .filter(Objects::nonNull)
            .map(Long::valueOf)
            .distinct()
            .toList();

        if (normalizedTagIds.isEmpty()) {
            conversation.setTags(new LinkedHashSet<>());
            return;
        }

        List<CaseTagNode> found = caseTagNodeRepository.findAllById(normalizedTagIds);
        Map<Long, CaseTagNode> byId = new LinkedHashMap<>();
        for (CaseTagNode tagNode : found) {
            byId.put(tagNode.getId(), tagNode);
        }

        List<Long> missing = normalizedTagIds.stream()
            .filter(id -> !byId.containsKey(id))
            .toList();
        if (!missing.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "Unknown tag ids: " + missing);
        }

        Set<CaseTagNode> ordered = new LinkedHashSet<>();
        for (Long tagId : normalizedTagIds) {
            ordered.add(byId.get(tagId));
        }
        conversation.setTags(ordered);
    }

    private void ensureUserExists(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(NOT_FOUND, "User not found");
        }
    }

    private CrmCaseDto toDto(CemConversation conversation) {
        CrmCaseDto dto = new CrmCaseDto();
        dto.setId(conversation.getId());
        dto.setSubject(valueOrDefault(conversation.getSubject(), "(No subject)"));
        dto.setStatus(valueOrDefault(conversation.getStatus(), "open"));
        dto.setPriority(valueOrDefault(conversation.getPriority(), "normal"));
        dto.setQueueName(valueOrDefault(conversation.getQueueName(), "General Queue"));

        if (conversation.getLastMessageAt() != null) {
            dto.setLastMessageAt(conversation.getLastMessageAt().format(DATE_TIME_FORMATTER));
        } else {
            dto.setLastMessageAt(null);
        }

        CemContact contact = conversation.getContact();
        dto.setContactName(contact != null ? valueOrDefault(contact.getFullName(), "Unknown Contact") : "Unknown Contact");
        dto.setContactEmail(contact != null ? valueOrDefault(contact.getPrimaryEmail(), "") : "");

        dto.setAssignedUserId(conversation.getAssignedUser() != null ? conversation.getAssignedUser().getId() : null);
        dto.setAssignedTo(userDisplayName(conversation.getAssignedUser()));
        dto.setCreatedBy(userDisplayName(conversation.getCreatedByUser()));

        Set<CaseTagNode> caseTags = conversation.getTags();
        if (caseTags == null || caseTags.isEmpty()) {
            dto.setTagNodeIds(List.of());
            dto.setTags(List.of());
        } else {
            List<CaseTagNode> sortedTags = caseTags.stream()
                .sorted(Comparator
                    .comparing((CaseTagNode t) -> valueOrDefault(t.getLabel(), ""))
                    .thenComparing(CaseTagNode::getId))
                .toList();
            dto.setTagNodeIds(sortedTags.stream().map(CaseTagNode::getId).toList());
            dto.setTags(sortedTags.stream()
                .map(t -> valueOrDefault(t.getLabel(), "Tag #" + t.getId()))
                .toList());
        }

        return dto;
    }

    private QaEvaluationDto toQaDto(QaEvaluation evaluation) {
        QaEvaluationDto dto = new QaEvaluationDto();
        dto.setId(evaluation.getId());
        dto.setConversationId(evaluation.getConversation() != null ? evaluation.getConversation().getId() : null);
        dto.setConversationSubject(evaluation.getConversation() != null ? valueOrDefault(evaluation.getConversation().getSubject(), "(No subject)") : "(No subject)");
        dto.setEvaluatedUserId(evaluation.getEvaluatedUser() != null ? evaluation.getEvaluatedUser().getId() : null);
        dto.setEvaluatedUserName(userDisplayName(evaluation.getEvaluatedUser()));
        dto.setEvaluatorUserId(evaluation.getEvaluatorUser() != null ? evaluation.getEvaluatorUser().getId() : null);
        dto.setEvaluatorUserName(userDisplayName(evaluation.getEvaluatorUser()));
        dto.setScore(evaluation.getScore());
        dto.setStrengths(valueOrDefault(evaluation.getStrengths(), ""));
        dto.setImprovements(valueOrDefault(evaluation.getImprovements(), ""));
        dto.setComment(valueOrDefault(evaluation.getComment(), ""));
        dto.setCreatedAt(evaluation.getCreatedAt() != null ? evaluation.getCreatedAt().format(DATE_TIME_FORMATTER) : null);
        return dto;
    }

    private String userDisplayName(User user) {
        if (user == null) {
            return "Unassigned";
        }
        String firstName = valueOrDefault(user.getFirstName(), "");
        String lastName = valueOrDefault(user.getLastName(), "");
        String fullName = (firstName + " " + lastName).trim();
        return fullName.isBlank() ? valueOrDefault(user.getEmail(), "Unknown") : fullName;
    }

    private String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String noteToHtml(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String escaped = value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
        return escaped.replace("\r\n", "<br/>").replace("\n", "<br/>");
    }

    private User getCurrentUserOrThrow() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "No authenticated user");
        }
        User user = userRepository.findByEmail(auth.getName());
        if (user == null) {
            throw new ResponseStatusException(NOT_FOUND, "Authenticated user not found");
        }
        return user;
    }

    private String normalizeRole(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            return "";
        }
        String role = rawRole.trim().toUpperCase();
        if (role.startsWith("ROLE_")) {
            role = role.substring("ROLE_".length());
        }
        if ("1".equals(role)) return "ADMIN";
        if ("2".equals(role)) return "AGENT";
        return role;
    }
}


