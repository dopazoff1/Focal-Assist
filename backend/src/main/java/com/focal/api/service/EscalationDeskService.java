package com.focal.api.service;

import com.focal.api.dto.*;
import com.focal.api.models.EscalationComment;
import com.focal.api.models.EscalationTicket;
import com.focal.api.models.User;
import com.focal.api.repository.EscalationCommentRepository;
import com.focal.api.repository.EscalationTicketRepository;
import com.focal.api.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class EscalationDeskService {

    private static final Set<String> VALID_STATUSES = Set.of(
        "open",
        "escalated",
        "investigating",
        "waiting_l1",
        "resolved",
        "closed",
        "duplicate_closed"
    );

    private static final Set<String> VALID_PRIORITIES = Set.of("low", "medium", "high", "critical");

    private final EscalationTicketRepository ticketRepository;
    private final EscalationCommentRepository commentRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public EscalationDeskService(
        EscalationTicketRepository ticketRepository,
        EscalationCommentRepository commentRepository,
        UserRepository userRepository
    ) {
        this.ticketRepository = ticketRepository;
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
    }

    public EscalationWorkspaceDto getWorkspace() {
        List<EscalationTicket> tickets = ticketRepository.findAllByOrderByUpdatedAtDesc();
        Map<Long, List<EscalationComment>> commentsMap = loadCommentsByTicket(
            tickets.stream().map(EscalationTicket::getId).filter(Objects::nonNull).toList()
        );
        return toWorkspaceDto(tickets, commentsMap);
    }

    public List<EscalationL2UserDto> listL2Users() {
        return userRepository.findAll().stream()
            .filter(user -> Boolean.TRUE.equals(user.getActive()))
            .filter(user -> isL2Role(normalizeRole(user.getRole())))
            .map(this::toL2UserDto)
            .sorted(Comparator
                .comparing((EscalationL2UserDto row) -> safe(row.getFirstName()))
                .thenComparing(row -> safe(row.getLastName()))
            )
            .toList();
    }

    @Transactional
    public EscalationTicketDto createTicket(EscalationCreateTicketRequestDto request, User actor) {
        String title = safe(request == null ? null : request.getTitle());
        if (title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket title is required.");
        }
        EscalationTicket ticket = new EscalationTicket();
        ticket.setKey("ESC-TMP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        ticket.setTitle(limit(title, 280));
        ticket.setDescription(safe(request == null ? null : request.getDescription()));
        ticket.setCustomerEmail(limit(safe(request == null ? null : request.getCustomerEmail()), 255));
        ticket.setClientId(limit(safe(request == null ? null : request.getClientId()), 120));
        ticket.setIssueTypesJson(encodeIssueTypes(request == null ? List.of() : request.getIssueTypes()));
        ticket.setPriority(normalizePriority(request == null ? null : request.getPriority()));
        ticket.setStatus("open");
        ticket.setLevel("L1");
        ticket.setCreatedByUserId(actor.getId());
        ticket.setCreatedByName(actorFullName(actor));
        ticket.setCreatedByRole(normalizeRole(actor.getRole()));
        ticket.setL2AssigneeUserId(null);
        ticket.setL2AssigneeName("");
        ticket.setEscalationReason("");
        ticket.setEscalatedAt(null);
        ticket.setJiraIssueKey("");
        ticket.setJiraIssueUrl("");
        ticket.setJiraStatus("");
        ticket.setJiraSyncedAt(null);
        ticket.setDuplicateOfTicketId(null);
        ticket.setCreatedAt(LocalDateTime.now());
        ticket.setUpdatedAt(LocalDateTime.now());
        EscalationTicket saved = ticketRepository.save(ticket);
        saved.setKey("ESC-" + saved.getId());
        saved = ticketRepository.save(saved);
        addCommentInternal(saved, "Ticket created by " + actorFullName(actor) + ".", actor, "internal");
        return toTicketDto(saved);
    }

    @Transactional
    public EscalationTicketDto escalateTicket(Long ticketId, EscalationEscalateRequestDto request, User actor) {
        EscalationTicket ticket = requireTicket(ticketId);
        LocalDateTime now = LocalDateTime.now();
        ticket.setLevel("L2");
        ticket.setStatus("escalated");
        ticket.setEscalationReason(safe(request == null ? null : request.getReason()));
        Long l2UserId = request == null ? null : request.getL2AssigneeUserId();
        String l2Name = safe(request == null ? null : request.getL2AssigneeName());
        ticket.setL2AssigneeUserId(l2UserId == null || l2UserId <= 0 ? null : l2UserId);
        ticket.setL2AssigneeName(l2Name);
        ticket.setEscalatedAt(now);
        ticket.setUpdatedAt(now);
        EscalationTicket saved = ticketRepository.save(ticket);
        String reasonText = safe(saved.getEscalationReason());
        String targetText = safe(saved.getL2AssigneeName()).isBlank() ? "" : (" to " + saved.getL2AssigneeName());
        String reasonSuffix = reasonText.isBlank() ? "" : (" Reason: " + reasonText);
        addCommentInternal(saved, "Escalated" + targetText + " by " + actorFullName(actor) + "." + reasonSuffix, actor, "internal");
        return toTicketDto(saved);
    }

    @Transactional
    public EscalationCommentDto addComment(Long ticketId, EscalationAddCommentRequestDto request, User actor) {
        EscalationTicket ticket = requireTicket(ticketId);
        String body = safe(request == null ? null : request.getBody());
        if (body.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment is empty.");
        }
        String source = safe(request == null ? null : request.getSource()).toLowerCase(Locale.ROOT);
        if (!source.equals("jira")) {
            source = "internal";
        }
        EscalationComment comment = addCommentInternal(ticket, body, actor, source);
        return toCommentDto(comment);
    }

    @Transactional
    public EscalationTicketDto assignL2(Long ticketId, EscalationAssignL2RequestDto request, User actor) {
        EscalationTicket ticket = requireTicket(ticketId);
        Long assigneeId = request == null ? null : request.getL2AssigneeUserId();
        String assigneeName = safe(request == null ? null : request.getL2AssigneeName());
        ticket.setL2AssigneeUserId(assigneeId == null || assigneeId <= 0 ? null : assigneeId);
        ticket.setL2AssigneeName(assigneeName);
        ticket.setUpdatedAt(LocalDateTime.now());
        EscalationTicket saved = ticketRepository.save(ticket);
        addCommentInternal(saved, "Assigned L2 owner: " + (safe(saved.getL2AssigneeName()).isBlank() ? "Unassigned" : saved.getL2AssigneeName()) + ".", actor, "internal");
        return toTicketDto(saved);
    }

    @Transactional
    public EscalationTicketDto updateStatus(Long ticketId, EscalationUpdateStatusRequestDto request, User actor) {
        EscalationTicket ticket = requireTicket(ticketId);
        String status = normalizeStatus(request == null ? null : request.getStatus());
        boolean resolveRequested = status.equals("resolved") || status.equals("closed");
        if (resolveRequested && !safe(ticket.getJiraIssueKey()).isBlank() && !isJiraResolvedStatus(ticket.getJiraStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot resolve this ticket before Jira is resolved.");
        }
        ticket.setStatus(status);
        ticket.setLevel(isResolvedStatus(status) ? "DONE" : ("L1".equalsIgnoreCase(ticket.getLevel()) ? "L1" : "L2"));
        ticket.setUpdatedAt(LocalDateTime.now());
        EscalationTicket saved = ticketRepository.save(ticket);
        addCommentInternal(saved, "Status changed to " + status + ".", actor, "internal");
        return toTicketDto(saved);
    }

    @Transactional
    public EscalationClaimResultDto claimForL2(Long ticketId, User actor) {
        EscalationTicket ticket = ticketRepository.findByIdForUpdate(ticketId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found."));
        String actorRole = normalizeRole(actor.getRole());
        if (isL1Role(actorRole)) {
            EscalationClaimResultDto denied = new EscalationClaimResultDto();
            denied.setOk(false);
            denied.setTicket(toTicketDto(ticket));
            denied.setError("Only L2 roles can claim L2 queue tickets.");
            return denied;
        }
        Long actorId = actor.getId();
        Long assigneeId = ticket.getL2AssigneeUserId();
        if (assigneeId != null && assigneeId > 0 && !assigneeId.equals(actorId)) {
            EscalationClaimResultDto blocked = new EscalationClaimResultDto();
            blocked.setOk(false);
            blocked.setTicket(toTicketDto(ticket));
            blocked.setError(ticket.getKey() + " is already assigned to " + (safe(ticket.getL2AssigneeName()).isBlank() ? "another L2 user" : ticket.getL2AssigneeName()) + ".");
            return blocked;
        }
        boolean wasUnassigned = assigneeId == null || assigneeId <= 0;
        if (wasUnassigned) {
            ticket.setL2AssigneeUserId(actorId);
            ticket.setL2AssigneeName(actorFullName(actor));
        }
        if ("L1".equalsIgnoreCase(ticket.getLevel())) {
            ticket.setLevel("L2");
        }
        if ("open".equalsIgnoreCase(ticket.getStatus())) {
            ticket.setStatus("investigating");
        }
        ticket.setUpdatedAt(LocalDateTime.now());
        EscalationTicket saved = ticketRepository.save(ticket);
        if (wasUnassigned) {
            addCommentInternal(saved, "L2 ownership claimed by " + actorFullName(actor) + ".", actor, "internal");
        }
        EscalationClaimResultDto result = new EscalationClaimResultDto();
        result.setOk(true);
        result.setTicket(toTicketDto(saved));
        result.setError(null);
        return result;
    }

    @Transactional
    public EscalationTicketDto linkJira(Long ticketId, EscalationJiraPatchRequestDto patch, User actor) {
        EscalationTicket ticket = requireTicket(ticketId);
        String previousKey = safe(ticket.getJiraIssueKey());
        String previousUrl = safe(ticket.getJiraIssueUrl());
        String previousStatus = safe(ticket.getJiraStatus());

        ticket.setJiraIssueKey(limit(safe(patch == null ? null : patch.getJiraIssueKey()), 80));
        ticket.setJiraIssueUrl(limit(safe(patch == null ? null : patch.getJiraIssueUrl()), 500));
        ticket.setJiraStatus(limit(safe(patch == null ? null : patch.getJiraStatus()), 120));
        LocalDateTime syncedAt = parseDateTime(patch == null ? null : patch.getJiraSyncedAt());
        ticket.setJiraSyncedAt(syncedAt == null ? LocalDateTime.now() : syncedAt);
        ticket.setUpdatedAt(LocalDateTime.now());
        EscalationTicket saved = ticketRepository.save(ticket);

        String nextKey = safe(saved.getJiraIssueKey());
        String nextUrl = safe(saved.getJiraIssueUrl());
        String nextStatus = safe(saved.getJiraStatus());
        boolean changed = !Objects.equals(previousKey, nextKey)
            || !Objects.equals(previousUrl, nextUrl)
            || !Objects.equals(previousStatus, nextStatus);
        if (changed) {
            StringBuilder msg = new StringBuilder();
            msg.append("Jira ticket updated");
            if (!nextKey.isBlank()) {
                msg.append(" (").append(nextKey).append(")");
            }
            if (!nextStatus.isBlank()) {
                msg.append(" - status: ").append(nextStatus);
            }
            msg.append(".");
            addCommentInternal(saved, msg.toString(), actor, "jira");
        }

        return toTicketDto(saved);
    }

    @Transactional
    public EscalationTicketDto updateJiraStatus(Long ticketId, String jiraStatus, User actor) {
        EscalationTicket ticket = requireTicket(ticketId);
        ticket.setJiraStatus(limit(safe(jiraStatus), 120));
        ticket.setJiraSyncedAt(LocalDateTime.now());
        ticket.setUpdatedAt(LocalDateTime.now());
        EscalationTicket saved = ticketRepository.save(ticket);
        String nextStatus = safe(saved.getJiraStatus());
        if (!nextStatus.isBlank()) {
            addCommentInternal(saved, "Jira status updated to " + nextStatus + ".", actor, "jira");
        }
        return toTicketDto(saved);
    }

    @Transactional
    public EscalationTicketDto closeAsDuplicate(Long ticketId, EscalationCloseDuplicateRequestDto request, User actor) {
        EscalationTicket ticket = requireTicket(ticketId);
        Long originalId = request == null ? null : request.getOriginalTicketId();
        if (originalId == null || originalId <= 0 || Objects.equals(originalId, ticketId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a valid original ticket.");
        }
        EscalationTicket original = requireTicket(originalId);
        ticket.setStatus("duplicate_closed");
        ticket.setLevel("DONE");
        ticket.setDuplicateOfTicketId(originalId);
        ticket.setUpdatedAt(LocalDateTime.now());
        EscalationTicket saved = ticketRepository.save(ticket);
        String note = safe(request == null ? null : request.getNote());
        String suffix = note.isBlank() ? "" : (" " + note);
        addCommentInternal(saved, "Closed as duplicate of " + original.getKey() + "." + suffix, actor, "internal");
        return toTicketDto(saved);
    }

    private EscalationTicket requireTicket(Long ticketId) {
        if (ticketId == null || ticketId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ticket id.");
        }
        return ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found."));
    }

    private EscalationComment addCommentInternal(EscalationTicket ticket, String body, User actor, String source) {
        EscalationComment comment = new EscalationComment();
        comment.setTicket(ticket);
        comment.setAuthorUserId(actor.getId());
        comment.setAuthorName(actorFullName(actor));
        comment.setAuthorRole(normalizeRole(actor.getRole()));
        comment.setSource(source == null || source.isBlank() ? "internal" : source);
        comment.setBody(body);
        comment.setCreatedAt(LocalDateTime.now());
        EscalationComment saved = commentRepository.save(comment);
        ticket.setUpdatedAt(saved.getCreatedAt());
        ticketRepository.save(ticket);
        return saved;
    }

    private EscalationWorkspaceDto toWorkspaceDto(
        List<EscalationTicket> tickets,
        Map<Long, List<EscalationComment>> commentsByTicket
    ) {
        EscalationWorkspaceDto dto = new EscalationWorkspaceDto();
        dto.setTickets(tickets.stream().map(this::toTicketDto).toList());
        Map<String, List<EscalationCommentDto>> comments = new LinkedHashMap<>();
        for (EscalationTicket ticket : tickets) {
            List<EscalationComment> rows = commentsByTicket.getOrDefault(ticket.getId(), List.of());
            comments.put(String.valueOf(ticket.getId()), rows.stream().map(this::toCommentDto).toList());
        }
        dto.setCommentsByTicket(comments);
        return dto;
    }

    private EscalationTicketDto toTicketDto(EscalationTicket ticket) {
        EscalationTicketDto dto = new EscalationTicketDto();
        dto.setId(ticket.getId());
        dto.setKey(safe(ticket.getKey()));
        dto.setTitle(safe(ticket.getTitle()));
        dto.setDescription(safe(ticket.getDescription()));
        dto.setCustomerEmail(safe(ticket.getCustomerEmail()));
        dto.setClientId(safe(ticket.getClientId()));
        dto.setIssueTypes(decodeIssueTypes(ticket.getIssueTypesJson()));
        dto.setPriority(safe(ticket.getPriority()));
        dto.setStatus(safe(ticket.getStatus()));
        dto.setLevel(safe(ticket.getLevel()));
        dto.setCreatedByUserId(ticket.getCreatedByUserId());
        dto.setCreatedByName(safe(ticket.getCreatedByName()));
        dto.setCreatedByRole(safe(ticket.getCreatedByRole()));
        dto.setL2AssigneeUserId(ticket.getL2AssigneeUserId());
        dto.setL2AssigneeName(safe(ticket.getL2AssigneeName()));
        dto.setEscalationReason(safe(ticket.getEscalationReason()));
        dto.setEscalatedAt(toIso(ticket.getEscalatedAt()));
        dto.setJiraIssueKey(safe(ticket.getJiraIssueKey()));
        dto.setJiraIssueUrl(safe(ticket.getJiraIssueUrl()));
        dto.setJiraStatus(safe(ticket.getJiraStatus()));
        dto.setJiraSyncedAt(toIso(ticket.getJiraSyncedAt()));
        dto.setDuplicateOfTicketId(ticket.getDuplicateOfTicketId());
        dto.setCreatedAt(toIso(ticket.getCreatedAt()));
        dto.setUpdatedAt(toIso(ticket.getUpdatedAt()));
        return dto;
    }

    private EscalationCommentDto toCommentDto(EscalationComment comment) {
        EscalationCommentDto dto = new EscalationCommentDto();
        dto.setId(comment.getId());
        dto.setTicketId(comment.getTicket() == null ? null : comment.getTicket().getId());
        dto.setAuthorUserId(comment.getAuthorUserId());
        dto.setAuthorName(safe(comment.getAuthorName()));
        dto.setAuthorRole(safe(comment.getAuthorRole()));
        dto.setSource(safe(comment.getSource()));
        dto.setBody(safe(comment.getBody()));
        dto.setCreatedAt(toIso(comment.getCreatedAt()));
        return dto;
    }

    private EscalationL2UserDto toL2UserDto(User user) {
        EscalationL2UserDto dto = new EscalationL2UserDto();
        dto.setId(user.getId());
        dto.setFirstName(safe(user.getFirstName()));
        dto.setLastName(safe(user.getLastName()));
        dto.setRole(normalizeRole(user.getRole()));
        dto.setActive(Boolean.TRUE.equals(user.getActive()));
        return dto;
    }

    private Map<Long, List<EscalationComment>> loadCommentsByTicket(List<Long> ticketIds) {
        if (ticketIds == null || ticketIds.isEmpty()) {
            return Map.of();
        }
        return commentRepository.findByTicket_IdInOrderByCreatedAtAsc(ticketIds).stream()
            .collect(Collectors.groupingBy(row -> row.getTicket().getId(), LinkedHashMap::new, Collectors.toList()));
    }

    private String normalizeStatus(String status) {
        String normalized = safe(status).toLowerCase(Locale.ROOT);
        if (!VALID_STATUSES.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status.");
        }
        return normalized;
    }

    private String normalizePriority(String priority) {
        String normalized = safe(priority).toLowerCase(Locale.ROOT);
        if (!VALID_PRIORITIES.contains(normalized)) {
            return "medium";
        }
        return normalized;
    }

    private String normalizeRole(String role) {
        return safe(role).trim().toUpperCase(Locale.ROOT);
    }

    private boolean isL1Role(String role) {
        String normalized = normalizeRole(role);
        return normalized.equals("AGENT")
            || normalized.equals("ROLE_AGENT")
            || normalized.equals("L1")
            || normalized.equals("ROLE_L1")
            || normalized.equals("2")
            || normalized.equals("ROLE_2");
    }

    private boolean isL2Role(String role) {
        String normalized = normalizeRole(role);
        return !normalized.isBlank() && !isL1Role(normalized);
    }

    private boolean isResolvedStatus(String status) {
        String normalized = safe(status).toLowerCase(Locale.ROOT);
        return normalized.equals("resolved")
            || normalized.equals("closed")
            || normalized.equals("duplicate_closed");
    }

    private boolean isJiraResolvedStatus(String jiraStatus) {
        String normalized = safe(jiraStatus).toLowerCase(Locale.ROOT);
        return normalized.contains("done")
            || normalized.contains("resolved")
            || normalized.contains("closed");
    }

    private String actorFullName(User actor) {
        String first = safe(actor == null ? null : actor.getFirstName());
        String last = safe(actor == null ? null : actor.getLastName());
        String full = (first + " " + last).trim();
        return full.isBlank() ? "Unknown" : full;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String limit(String value, int max) {
        String safeValue = value == null ? "" : value;
        if (safeValue.length() <= max) {
            return safeValue;
        }
        return safeValue.substring(0, max);
    }

    private String encodeIssueTypes(List<String> issueTypes) {
        List<String> normalized = issueTypes == null
            ? List.of()
            : issueTypes.stream()
                .map(this::safe)
                .filter(item -> !item.isBlank())
                .distinct()
                .limit(20)
                .toList();
        try {
            return objectMapper.writeValueAsString(normalized);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid issue types.");
        }
    }

    private List<String> decodeIssueTypes(String raw) {
        if (raw == null || raw.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> parsed = objectMapper.readValue(raw, new TypeReference<List<String>>() {});
            return parsed.stream().map(this::safe).filter(item -> !item.isBlank()).toList();
        } catch (Exception ex) {
            return Arrays.stream(raw.split(","))
                .map(this::safe)
                .filter(item -> !item.isBlank())
                .toList();
        }
    }

    private String toIso(LocalDateTime value) {
        return value == null ? null : value.toString();
    }

    private LocalDateTime parseDateTime(String raw) {
        String value = safe(raw);
        if (value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException ex) {
            try {
                return OffsetDateTime.parse(value).toLocalDateTime();
            } catch (DateTimeParseException ignored) {
                return null;
            }
        }
    }
}
