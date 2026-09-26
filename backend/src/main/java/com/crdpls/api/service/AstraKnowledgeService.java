package com.crdpls.api.service;

import com.crdpls.api.dto.*;
import com.crdpls.api.models.*;
import com.crdpls.api.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AstraKnowledgeService {

    private static final Set<String> ALLOWED_FEEDBACK = Set.of("LIKE", "DISLIKE");
    private static final Set<String> ALLOWED_TICKET_STATUS = Set.of("OPEN", "PENDING", "WAITING_CUSTOMER", "SOLVED", "CLOSED");
    private static final Set<String> ALLOWED_TICKET_PRIORITY = Set.of("LOW", "NORMAL", "HIGH", "URGENT");

    private final KbCategoryRepository kbCategoryRepository;
    private final KbArticleRepository kbArticleRepository;
    private final AstraKbArticleViewEventRepository viewEventRepository;
    private final AstraKbArticleFeedbackRepository feedbackRepository;
    private final AstraKbPublicTicketRepository publicTicketRepository;
    private final AstraLlmIntegrationRepository llmIntegrationRepository;
    private final UserRepository userRepository;

    public AstraKnowledgeService(
        KbCategoryRepository kbCategoryRepository,
        KbArticleRepository kbArticleRepository,
        AstraKbArticleViewEventRepository viewEventRepository,
        AstraKbArticleFeedbackRepository feedbackRepository,
        AstraKbPublicTicketRepository publicTicketRepository,
        AstraLlmIntegrationRepository llmIntegrationRepository,
        UserRepository userRepository
    ) {
        this.kbCategoryRepository = kbCategoryRepository;
        this.kbArticleRepository = kbArticleRepository;
        this.viewEventRepository = viewEventRepository;
        this.feedbackRepository = feedbackRepository;
        this.publicTicketRepository = publicTicketRepository;
        this.llmIntegrationRepository = llmIntegrationRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listActiveCategories() {
        List<KbCategory> categories = kbCategoryRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
        List<Map<String, Object>> response = new ArrayList<>();
        for (KbCategory category : categories) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", category.getId());
            row.put("name", safeText(category.getName()));
            row.put("displayOrder", category.getDisplayOrder() == null ? 0 : category.getDisplayOrder());
            response.add(row);
        }
        return response;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listActiveArticlesByCategory(Long categoryId) {
        List<KbArticle> articles = kbArticleRepository.findByCategoryIdAndIsActiveTrueOrderByDisplayOrderAsc(categoryId);
        return articles.stream().map(this::toArticleSummary).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getActiveArticle(Long articleId) {
        KbArticle article = findActiveArticleOrThrow(articleId);
        return toArticleDetails(article);
    }

    @Transactional
    public Map<String, Object> trackArticleView(Long articleId, AstraKbTrackViewRequestDto request, User viewer) {
        KbArticle article = findActiveArticleOrThrow(articleId);

        AstraKbArticleViewEvent event = new AstraKbArticleViewEvent();
        event.setArticle(article);
        event.setViewerUserId(viewer == null ? null : viewer.getId());
        event.setViewerEmail(trimOrNull(request == null ? null : request.getViewerEmail(), 255));
        event.setViewerName(trimOrNull(request == null ? null : request.getViewerName(), 180));
        event.setSessionId(trimOrNull(request == null ? null : request.getSessionId(), 120));
        event.setSource(normalizeSource(request == null ? null : request.getSource()));
        if (viewer != null) {
            if (event.getViewerEmail() == null) {
                event.setViewerEmail(trimOrNull(viewer.getEmail(), 255));
            }
            if (event.getViewerName() == null) {
                String fullName = ((safeText(viewer.getFirstName()) + " " + safeText(viewer.getLastName())).trim());
                event.setViewerName(trimOrNull(fullName, 180));
            }
        }
        viewEventRepository.save(event);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("articleId", articleId);
        response.put("eventId", event.getId());
        return response;
    }

    @Transactional
    public Map<String, Object> submitArticleFeedback(Long articleId, AstraKbFeedbackRequestDto request, User viewer) {
        KbArticle article = findActiveArticleOrThrow(articleId);
        String sentiment = normalizeFeedbackSentiment(request == null ? null : request.getSentiment());
        if (sentiment == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sentiment must be LIKE or DISLIKE");
        }

        AstraKbArticleFeedback feedback = new AstraKbArticleFeedback();
        feedback.setArticle(article);
        feedback.setSentiment(sentiment);
        feedback.setFeedbackText(trimOrNull(request == null ? null : request.getFeedbackText(), 5000));
        feedback.setViewerUserId(viewer == null ? null : viewer.getId());
        feedback.setViewerEmail(trimOrNull(request == null ? null : request.getViewerEmail(), 255));
        feedback.setViewerName(trimOrNull(request == null ? null : request.getViewerName(), 180));
        if (viewer != null) {
            if (feedback.getViewerEmail() == null) {
                feedback.setViewerEmail(trimOrNull(viewer.getEmail(), 255));
            }
            if (feedback.getViewerName() == null) {
                String fullName = ((safeText(viewer.getFirstName()) + " " + safeText(viewer.getLastName())).trim());
                feedback.setViewerName(trimOrNull(fullName, 180));
            }
        }
        feedbackRepository.save(feedback);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("articleId", articleId);
        response.put("feedbackId", feedback.getId());
        response.put("sentiment", sentiment);
        return response;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listArticleFeedback(Long articleId, int limit) {
        findActiveArticleOrThrow(articleId);
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return feedbackRepository.findTop200ByArticle_IdOrderByCreatedAtDesc(articleId)
            .stream()
            .limit(safeLimit)
            .map(this::toFeedbackRow)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDashboardOverview(int days) {
        int periodDays = Math.max(1, Math.min(days, 365));
        LocalDateTime since = LocalDateTime.now().minusDays(periodDays);

        List<AstraKbArticleViewEvent> views = viewEventRepository.findByCreatedAtAfter(since);
        List<AstraKbArticleFeedback> feedbackRows = feedbackRepository.findByCreatedAtAfter(since);
        List<AstraKbPublicTicket> tickets = publicTicketRepository.findAllByOrderByUpdatedAtDesc();

        Map<Long, Long> viewsByArticle = new HashMap<>();
        Map<Long, LocalDateTime> lastViewedByArticle = new HashMap<>();
        Set<String> uniqueViewers = new HashSet<>();
        List<Map<String, Object>> recentViewers = new ArrayList<>();
        Set<String> recentViewerDedupe = new HashSet<>();

        views.sort(Comparator.comparing(AstraKbArticleViewEvent::getCreatedAt).reversed());
        for (AstraKbArticleViewEvent view : views) {
            Long articleId = view.getArticle() == null ? null : view.getArticle().getId();
            if (articleId != null) {
                viewsByArticle.merge(articleId, 1L, Long::sum);
                LocalDateTime currentLast = lastViewedByArticle.get(articleId);
                if (currentLast == null || (view.getCreatedAt() != null && view.getCreatedAt().isAfter(currentLast))) {
                    lastViewedByArticle.put(articleId, view.getCreatedAt());
                }
            }

            String viewerKey = buildViewerKey(view.getViewerUserId(), view.getSessionId(), view.getViewerEmail(), view.getId());
            uniqueViewers.add(viewerKey);

            if (recentViewers.size() < 14 && recentViewerDedupe.add(viewerKey)) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("viewer", firstNonBlank(view.getViewerName(), view.getViewerEmail(), "Anonymous"));
                row.put("email", safeText(view.getViewerEmail()));
                row.put("source", safeText(view.getSource()));
                row.put("viewedAt", formatDate(view.getCreatedAt()));
                row.put("articleId", articleId);
                row.put("articleTitle", view.getArticle() == null ? "" : safeText(view.getArticle().getTitle()));
                recentViewers.add(row);
            }
        }

        Map<Long, Long> likesByArticle = new HashMap<>();
        Map<Long, Long> dislikesByArticle = new HashMap<>();
        long likes = 0;
        long dislikes = 0;
        List<Map<String, Object>> recentFeedback = feedbackRows.stream()
            .sorted(Comparator.comparing(AstraKbArticleFeedback::getCreatedAt).reversed())
            .limit(14)
            .map(this::toFeedbackRow)
            .collect(Collectors.toList());

        for (AstraKbArticleFeedback row : feedbackRows) {
            Long articleId = row.getArticle() == null ? null : row.getArticle().getId();
            if ("LIKE".equalsIgnoreCase(row.getSentiment())) {
                likes++;
                if (articleId != null) {
                    likesByArticle.merge(articleId, 1L, Long::sum);
                }
            } else if ("DISLIKE".equalsIgnoreCase(row.getSentiment())) {
                dislikes++;
                if (articleId != null) {
                    dislikesByArticle.merge(articleId, 1L, Long::sum);
                }
            }
        }

        Map<Long, KbArticle> articleById = kbArticleRepository.findAllById(viewsByArticle.keySet())
            .stream()
            .collect(Collectors.toMap(KbArticle::getId, x -> x));

        List<Map<String, Object>> topArticles = viewsByArticle.entrySet().stream()
            .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
            .limit(10)
            .map(entry -> {
                Long articleId = entry.getKey();
                KbArticle article = articleById.get(articleId);
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("articleId", articleId);
                row.put("title", article == null ? ("Article #" + articleId) : safeText(article.getTitle()));
                row.put("category", article != null && article.getCategory() != null ? safeText(article.getCategory().getName()) : "");
                row.put("views", entry.getValue());
                row.put("likes", likesByArticle.getOrDefault(articleId, 0L));
                row.put("dislikes", dislikesByArticle.getOrDefault(articleId, 0L));
                row.put("lastViewedAt", formatDate(lastViewedByArticle.get(articleId)));
                return row;
            })
            .collect(Collectors.toList());

        long openTickets = tickets.stream().filter(t -> "OPEN".equalsIgnoreCase(t.getStatus())).count();
        long pendingTickets = tickets.stream().filter(t -> "PENDING".equalsIgnoreCase(t.getStatus())).count();
        long solvedTickets = tickets.stream().filter(t -> "SOLVED".equalsIgnoreCase(t.getStatus())).count();
        long closedTickets = tickets.stream().filter(t -> "CLOSED".equalsIgnoreCase(t.getStatus())).count();

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("views", views.size());
        totals.put("uniqueViewers", uniqueViewers.size());
        totals.put("feedbackCount", feedbackRows.size());
        totals.put("likes", likes);
        totals.put("dislikes", dislikes);
        totals.put("publicTickets", tickets.size());
        totals.put("openTickets", openTickets);
        totals.put("pendingTickets", pendingTickets);
        totals.put("solvedTickets", solvedTickets);
        totals.put("closedTickets", closedTickets);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("periodDays", periodDays);
        response.put("generatedAt", formatDate(LocalDateTime.now()));
        response.put("totals", totals);
        response.put("topArticles", topArticles);
        response.put("recentFeedback", recentFeedback);
        response.put("recentViewers", recentViewers);
        response.put("tickets", tickets.stream().limit(10).map(this::toTicketRow).collect(Collectors.toList()));
        response.put("llmIntegrations", listLlmIntegrations());
        return response;
    }

    @Transactional
    public Map<String, Object> createPublicTicket(AstraKbPublicTicketCreateRequestDto request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        String requesterName = trimOrNull(request.getRequesterName(), 180);
        String requesterEmail = trimOrNull(request.getRequesterEmail(), 255);
        String subject = trimOrNull(request.getSubject(), 255);
        String description = trimOrNull(request.getDescription(), 20000);
        String requesterCompany = trimOrNull(request.getRequesterCompany(), 180);
        String priority = normalizePriority(request.getPriority());

        if (requesterName == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "requesterName is required");
        }
        if (requesterEmail == null || !requesterEmail.contains("@")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid requesterEmail is required");
        }
        if (subject == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "subject is required");
        }
        if (description == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "description is required");
        }

        String articleTitle = null;
        Long articleId = request.getArticleId();
        if (articleId != null) {
            KbArticle linked = findActiveArticleOrThrow(articleId);
            articleTitle = safeText(linked.getTitle());
        }

        AstraKbPublicTicket ticket = new AstraKbPublicTicket();
        ticket.setTicketKey("TMP-" + UUID.randomUUID());
        ticket.setArticleId(articleId);
        ticket.setArticleTitleSnapshot(articleTitle);
        ticket.setRequesterName(requesterName);
        ticket.setRequesterEmail(requesterEmail.toLowerCase(Locale.ROOT));
        ticket.setRequesterCompany(requesterCompany);
        ticket.setSubject(subject);
        ticket.setDescription(description);
        ticket.setPriority(priority);
        ticket.setStatus("OPEN");
        AstraKbPublicTicket saved = publicTicketRepository.save(ticket);
        saved.setTicketKey("ASTRA-" + String.format("%05d", saved.getId()));
        saved = publicTicketRepository.save(saved);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("ticket", toTicketRow(saved));
        return response;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listPublicTickets() {
        return publicTicketRepository.findAllByOrderByUpdatedAtDesc()
            .stream()
            .map(this::toTicketRow)
            .collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> updatePublicTicket(Long ticketId, AstraKbTicketUpdateRequestDto request, User actor) {
        AstraKbPublicTicket ticket = publicTicketRepository.findById(ticketId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));

        String normalizedStatus = normalizeTicketStatus(request == null ? null : request.getStatus());
        if (normalizedStatus != null) {
            ticket.setStatus(normalizedStatus);
        }

        Long assigneeUserId = request == null ? null : request.getAssigneeUserId();
        String assigneeName = trimOrNull(request == null ? null : request.getAssigneeName(), 180);
        if (assigneeUserId != null) {
            User assignee = userRepository.findById(assigneeUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid assigneeUserId"));
            ticket.setAssigneeUserId(assignee.getId());
            ticket.setAssigneeName((safeText(assignee.getFirstName()) + " " + safeText(assignee.getLastName())).trim());
        } else if (assigneeName != null) {
            ticket.setAssigneeUserId(null);
            ticket.setAssigneeName(assigneeName);
        } else if (request != null && request.getAssigneeUserId() == null && request.getAssigneeName() != null && request.getAssigneeName().isBlank()) {
            ticket.setAssigneeUserId(null);
            ticket.setAssigneeName(null);
        }

        String note = trimOrNull(request == null ? null : request.getInternalNote(), 20000);
        if (note != null || (request != null && request.getInternalNote() != null)) {
            String actorLabel = actor == null ? "System" : ((safeText(actor.getFirstName()) + " " + safeText(actor.getLastName())).trim());
            String now = formatDate(LocalDateTime.now());
            String existing = ticket.getInternalNote() == null ? "" : ticket.getInternalNote().trim();
            String line = "[" + now + "] " + actorLabel + ": " + (note == null ? "" : note);
            ticket.setInternalNote(existing.isBlank() ? line : (existing + "\n\n" + line));
        }

        AstraKbPublicTicket saved = publicTicketRepository.save(ticket);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("ticket", toTicketRow(saved));
        return response;
    }

    @Transactional
    public List<Map<String, Object>> listLlmIntegrations() {
        ensureDefaultIntegrations();
        return llmIntegrationRepository.findAllByOrderByProviderNameAsc()
            .stream()
            .map(this::toLlmRow)
            .collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> upsertLlmIntegration(String providerCode, AstraLlmIntegrationUpsertRequestDto request) {
        String code = normalizeProviderCode(providerCode);
        if (code == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "providerCode is required");
        }

        ensureDefaultIntegrations();
        AstraLlmIntegration integration = llmIntegrationRepository.findByProviderCodeIgnoreCase(code)
            .orElseGet(() -> {
                AstraLlmIntegration item = new AstraLlmIntegration();
                item.setProviderCode(code);
                item.setProviderName(code.toUpperCase(Locale.ROOT));
                return item;
            });

        if (request != null) {
            if (request.getEnabled() != null) {
                integration.setEnabled(request.getEnabled());
            }
            String providerName = trimOrNull(request.getProviderName(), 120);
            if (providerName != null) {
                integration.setProviderName(providerName);
            }
            integration.setEndpointUrl(trimOrNull(request.getEndpointUrl(), 500));
            integration.setModelName(trimOrNull(request.getModelName(), 120));
            if (request.getApiKey() != null) {
                integration.setApiKey(trimOrNull(request.getApiKey(), 512));
            }
            integration.setNotes(trimOrNull(request.getNotes(), 8000));
        }

        AstraLlmIntegration saved = llmIntegrationRepository.save(integration);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("integration", toLlmRow(saved));
        return response;
    }

    private void ensureDefaultIntegrations() {
        Map<String, String> defaults = new LinkedHashMap<>();
        defaults.put("openai", "OpenAI");
        defaults.put("azure-openai", "Azure OpenAI");
        defaults.put("anthropic", "Anthropic Claude");
        defaults.put("google-vertex", "Google Vertex AI");
        defaults.put("aws-bedrock", "AWS Bedrock");
        defaults.put("cohere", "Cohere");
        defaults.put("mistral", "Mistral AI");
        defaults.put("meta-llama", "Meta Llama");
        defaults.put("perplexity", "Perplexity");
        defaults.put("together", "Together AI");
        defaults.put("groq", "Groq");
        defaults.put("ollama", "Ollama");
        defaults.put("vllm", "vLLM OpenAI-Compatible");
        defaults.put("custom-openai", "Custom OpenAI-Compatible");

        Set<String> existing = llmIntegrationRepository.findAllByOrderByProviderNameAsc().stream()
            .map(AstraLlmIntegration::getProviderCode)
            .filter(Objects::nonNull)
            .map(x -> x.trim().toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());

        List<AstraLlmIntegration> missing = new ArrayList<>();
        for (Map.Entry<String, String> row : defaults.entrySet()) {
            String code = row.getKey();
            if (existing.contains(code)) {
                continue;
            }
            AstraLlmIntegration integration = new AstraLlmIntegration();
            integration.setProviderCode(code);
            integration.setProviderName(row.getValue());
            integration.setEnabled(false);
            integration.setEndpointUrl(defaultEndpointFor(code));
            integration.setModelName(defaultModelFor(code));
            missing.add(integration);
        }
        if (!missing.isEmpty()) {
            llmIntegrationRepository.saveAll(missing);
        }
    }

    private String defaultEndpointFor(String code) {
        return switch (code) {
            case "openai" -> "https://api.openai.com/v1/chat/completions";
            case "anthropic" -> "https://api.anthropic.com/v1/messages";
            case "google-vertex" -> "https://us-central1-aiplatform.googleapis.com";
            case "aws-bedrock" -> "https://bedrock-runtime.{region}.amazonaws.com";
            case "cohere" -> "https://api.cohere.ai/v1/chat";
            case "mistral" -> "https://api.mistral.ai/v1/chat/completions";
            case "perplexity" -> "https://api.perplexity.ai/chat/completions";
            case "groq" -> "https://api.groq.com/openai/v1/chat/completions";
            case "ollama" -> "http://localhost:11434/v1/chat/completions";
            case "vllm", "custom-openai" -> "https://your-endpoint.example.com/v1/chat/completions";
            default -> "";
        };
    }

    private String defaultModelFor(String code) {
        return switch (code) {
            case "openai", "azure-openai", "custom-openai", "vllm" -> "gpt-4o-mini";
            case "anthropic" -> "claude-3-5-sonnet";
            case "google-vertex" -> "gemini-1.5-pro";
            case "aws-bedrock" -> "anthropic.claude-3-5-sonnet";
            case "cohere" -> "command-r-plus";
            case "mistral" -> "mistral-large";
            case "meta-llama" -> "llama-3.1-70b";
            case "perplexity" -> "sonar-pro";
            case "together" -> "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo";
            case "groq" -> "llama-3.1-70b-versatile";
            case "ollama" -> "llama3.1";
            default -> "";
        };
    }

    private KbArticle findActiveArticleOrThrow(Long articleId) {
        KbArticle article = kbArticleRepository.findById(articleId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Article not found"));
        if (!Boolean.TRUE.equals(article.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Article not found");
        }
        if (article.getCategory() == null || !Boolean.TRUE.equals(article.getCategory().getIsActive())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Article not found");
        }
        return article;
    }

    private Map<String, Object> toArticleSummary(KbArticle article) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", article.getId());
        row.put("title", safeText(article.getTitle()));
        row.put("displayOrder", article.getDisplayOrder() == null ? 0 : article.getDisplayOrder());
        row.put("categoryId", article.getCategory() == null ? null : article.getCategory().getId());
        row.put("categoryName", article.getCategory() == null ? "" : safeText(article.getCategory().getName()));
        return row;
    }

    private Map<String, Object> toArticleDetails(KbArticle article) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", article.getId());
        row.put("title", safeText(article.getTitle()));
        row.put("content", article.getContent() == null ? "" : article.getContent());
        row.put("displayOrder", article.getDisplayOrder() == null ? 0 : article.getDisplayOrder());
        row.put("categoryId", article.getCategory() == null ? null : article.getCategory().getId());
        row.put("categoryName", article.getCategory() == null ? "" : safeText(article.getCategory().getName()));
        return row;
    }

    private Map<String, Object> toFeedbackRow(AstraKbArticleFeedback row) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", row.getId());
        map.put("articleId", row.getArticle() == null ? null : row.getArticle().getId());
        map.put("articleTitle", row.getArticle() == null ? "" : safeText(row.getArticle().getTitle()));
        map.put("sentiment", safeText(row.getSentiment()));
        map.put("feedbackText", row.getFeedbackText() == null ? "" : row.getFeedbackText());
        map.put("viewerName", safeText(row.getViewerName()));
        map.put("viewerEmail", safeText(row.getViewerEmail()));
        map.put("createdAt", formatDate(row.getCreatedAt()));
        return map;
    }

    private Map<String, Object> toTicketRow(AstraKbPublicTicket ticket) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", ticket.getId());
        row.put("ticketKey", safeText(ticket.getTicketKey()));
        row.put("articleId", ticket.getArticleId());
        row.put("articleTitle", safeText(ticket.getArticleTitleSnapshot()));
        row.put("requesterName", safeText(ticket.getRequesterName()));
        row.put("requesterEmail", safeText(ticket.getRequesterEmail()));
        row.put("requesterCompany", safeText(ticket.getRequesterCompany()));
        row.put("subject", safeText(ticket.getSubject()));
        row.put("description", ticket.getDescription() == null ? "" : ticket.getDescription());
        row.put("priority", safeText(ticket.getPriority()));
        row.put("status", safeText(ticket.getStatus()));
        row.put("assigneeUserId", ticket.getAssigneeUserId());
        row.put("assigneeName", safeText(ticket.getAssigneeName()));
        row.put("internalNote", ticket.getInternalNote() == null ? "" : ticket.getInternalNote());
        row.put("createdAt", formatDate(ticket.getCreatedAt()));
        row.put("updatedAt", formatDate(ticket.getUpdatedAt()));
        return row;
    }

    private Map<String, Object> toLlmRow(AstraLlmIntegration item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getId());
        row.put("providerCode", safeText(item.getProviderCode()));
        row.put("providerName", safeText(item.getProviderName()));
        row.put("enabled", Boolean.TRUE.equals(item.getEnabled()));
        row.put("endpointUrl", safeText(item.getEndpointUrl()));
        row.put("modelName", safeText(item.getModelName()));
        row.put("hasApiKey", item.getApiKey() != null && !item.getApiKey().isBlank());
        row.put("apiKeyMasked", maskApiKey(item.getApiKey()));
        row.put("notes", item.getNotes() == null ? "" : item.getNotes());
        row.put("createdAt", formatDate(item.getCreatedAt()));
        row.put("updatedAt", formatDate(item.getUpdatedAt()));
        return row;
    }

    private String normalizeFeedbackSentiment(String raw) {
        String value = trimUpper(raw, 12);
        if (value == null || !ALLOWED_FEEDBACK.contains(value)) return null;
        return value;
    }

    private String normalizeTicketStatus(String raw) {
        String value = trimUpper(raw, 24);
        if (value == null || !ALLOWED_TICKET_STATUS.contains(value)) return null;
        return value;
    }

    private String normalizePriority(String raw) {
        String value = trimUpper(raw, 16);
        if (value == null || !ALLOWED_TICKET_PRIORITY.contains(value)) {
            return "NORMAL";
        }
        return value;
    }

    private String normalizeSource(String raw) {
        String value = trimUpper(raw, 48);
        if (value == null) return "ASTRA";
        return value;
    }

    private String normalizeProviderCode(String raw) {
        if (raw == null) return null;
        String v = raw.trim().toLowerCase(Locale.ROOT);
        if (v.isBlank()) return null;
        if (v.length() > 48) {
            v = v.substring(0, 48);
        }
        return v;
    }

    private String trimOrNull(String raw, int maxLen) {
        if (raw == null) return null;
        String value = raw.trim();
        if (value.isBlank()) return null;
        if (value.length() > maxLen) {
            value = value.substring(0, maxLen);
        }
        return value;
    }

    private String trimUpper(String raw, int maxLen) {
        String value = trimOrNull(raw, maxLen);
        return value == null ? null : value.toUpperCase(Locale.ROOT);
    }

    private String safeText(String value) {
        return value == null ? "" : value;
    }

    private String maskApiKey(String value) {
        if (value == null || value.isBlank()) return "";
        String key = value.trim();
        if (key.length() <= 8) return "********";
        return key.substring(0, 4) + "..." + key.substring(key.length() - 4);
    }

    private String buildViewerKey(Long userId, String sessionId, String email, Long eventId) {
        if (userId != null) return "u:" + userId;
        if (sessionId != null && !sessionId.isBlank()) return "s:" + sessionId.trim();
        if (email != null && !email.isBlank()) return "e:" + email.trim().toLowerCase(Locale.ROOT);
        return "evt:" + eventId;
    }

    private String firstNonBlank(String... values) {
        if (values == null) return "";
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }

    private String formatDate(LocalDateTime value) {
        if (value == null) return "";
        return value.atZone(ZoneId.systemDefault()).toInstant().toString();
    }
}

