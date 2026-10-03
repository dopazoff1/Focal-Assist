package com.focal.api.service;

import com.focal.api.dto.KbTrackTimeRequestDto;
import com.focal.api.models.KbArticle;
import com.focal.api.models.KbArticleTimeLog;
import com.focal.api.models.User;
import com.focal.api.repository.KbArticleRepository;
import com.focal.api.repository.KbArticleTimeLogRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class KbAnalyticsService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final KbArticleRepository kbArticleRepository;
    private final KbArticleTimeLogRepository kbArticleTimeLogRepository;

    public KbAnalyticsService(
        KbArticleRepository kbArticleRepository,
        KbArticleTimeLogRepository kbArticleTimeLogRepository
    ) {
        this.kbArticleRepository = kbArticleRepository;
        this.kbArticleTimeLogRepository = kbArticleTimeLogRepository;
    }

    @Transactional
    public Map<String, Object> trackTime(User viewer, KbTrackTimeRequestDto request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required.");
        }
        Long articleId = request.getArticleId();
        if (articleId == null || articleId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "articleId is required.");
        }

        int seconds = request.getSecondsSpent() == null ? 0 : request.getSecondsSpent();
        if (seconds <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "secondsSpent must be > 0.");
        }
        if (seconds > 3600) {
            seconds = 3600;
        }

        KbArticle article = kbArticleRepository.findById(articleId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Article not found."));

        KbArticleTimeLog log = new KbArticleTimeLog();
        log.setArticleId(article.getId());
        log.setArticleTitleSnapshot(trim(article.getTitle(), 255));
        log.setCategoryNameSnapshot(article.getCategory() == null ? null : trim(article.getCategory().getName(), 255));
        log.setViewerUserId(viewer == null ? null : viewer.getId());
        log.setViewerEmail(viewer == null ? null : trim(viewer.getEmail(), 255));
        log.setViewerName(viewer == null ? null : trim(buildName(viewer), 180));
        log.setSessionId(trim(request.getSessionId(), 120));
        log.setSource(normalizeSource(request.getSource()));
        log.setSecondsSpent(seconds);
        kbArticleTimeLogRepository.save(log);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("eventId", log.getId());
        response.put("articleId", log.getArticleId());
        response.put("secondsSaved", seconds);
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard(int days) {
        int periodDays = Math.max(1, Math.min(days, 365));
        LocalDateTime since = LocalDateTime.now().minusDays(periodDays);

        List<KbArticleTimeLog> logs = kbArticleTimeLogRepository.findByTrackedAtAfterOrderByTrackedAtDesc(since);

        Map<Long, ArticleAgg> byArticle = new LinkedHashMap<>();
        Map<String, AgentAgg> byAgent = new LinkedHashMap<>();
        Map<String, Integer> articleAgentSeconds = new HashMap<>();

        long totalSeconds = 0L;
        for (KbArticleTimeLog log : logs) {
            int seconds = Math.max(0, log.getSecondsSpent() == null ? 0 : log.getSecondsSpent());
            if (seconds == 0) {
                continue;
            }

            totalSeconds += seconds;

            Long articleId = log.getArticleId();
            String articleTitle = firstNonBlank(log.getArticleTitleSnapshot(), "Article #" + articleId);
            String category = firstNonBlank(log.getCategoryNameSnapshot(), "Uncategorized");

            ArticleAgg articleAgg = byArticle.computeIfAbsent(articleId, id -> new ArticleAgg(id, articleTitle, category));
            articleAgg.totalSeconds += seconds;
            articleAgg.eventCount += 1;
            articleAgg.viewerKeys.add(viewerKey(log));
            if (articleAgg.lastTrackedAt == null || isAfter(log.getTrackedAt(), articleAgg.lastTrackedAt)) {
                articleAgg.lastTrackedAt = log.getTrackedAt();
            }

            String viewerKey = viewerKey(log);
            AgentAgg agentAgg = byAgent.computeIfAbsent(viewerKey, key -> new AgentAgg(log.getViewerUserId(), firstNonBlank(log.getViewerName(), "Unknown"), firstNonBlank(log.getViewerEmail(), "")));
            agentAgg.totalSeconds += seconds;
            agentAgg.articleIds.add(articleId);
            if (agentAgg.lastTrackedAt == null || isAfter(log.getTrackedAt(), agentAgg.lastTrackedAt)) {
                agentAgg.lastTrackedAt = log.getTrackedAt();
            }

            String pairKey = articleId + "|" + viewerKey;
            articleAgentSeconds.merge(pairKey, seconds, Integer::sum);
            Map<Long, Integer> articleSeconds = agentAgg.secondsByArticle;
            articleSeconds.merge(articleId, seconds, Integer::sum);
        }

        List<Map<String, Object>> articles = byArticle.values().stream()
            .sorted((a, b) -> Long.compare(b.totalSeconds, a.totalSeconds))
            .map(agg -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("articleId", agg.articleId);
                row.put("title", agg.title);
                row.put("category", agg.category);
                row.put("totalSeconds", agg.totalSeconds);
                row.put("totalMinutes", round2(agg.totalSeconds / 60.0));
                row.put("totalHours", round2(agg.totalSeconds / 3600.0));
                row.put("viewers", agg.viewerKeys.size());
                row.put("eventCount", agg.eventCount);
                row.put("lastTrackedAt", formatDate(agg.lastTrackedAt));
                return row;
            })
            .toList();

        List<Map<String, Object>> agents = byAgent.values().stream()
            .sorted((a, b) -> Long.compare(b.totalSeconds, a.totalSeconds))
            .map(agg -> {
                Long topArticleId = null;
                int topSeconds = 0;
                for (Map.Entry<Long, Integer> entry : agg.secondsByArticle.entrySet()) {
                    if (entry.getValue() > topSeconds) {
                        topSeconds = entry.getValue();
                        topArticleId = entry.getKey();
                    }
                }

                String topArticleTitle = "";
                if (topArticleId != null) {
                    ArticleAgg topArticle = byArticle.get(topArticleId);
                    if (topArticle != null) {
                        topArticleTitle = topArticle.title;
                    }
                }

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("userId", agg.userId);
                row.put("name", agg.name);
                row.put("email", agg.email);
                row.put("totalSeconds", agg.totalSeconds);
                row.put("totalMinutes", round2(agg.totalSeconds / 60.0));
                row.put("totalHours", round2(agg.totalSeconds / 3600.0));
                row.put("articlesCount", agg.articleIds.size());
                row.put("topArticleId", topArticleId);
                row.put("topArticleTitle", topArticleTitle);
                row.put("topArticleSeconds", topSeconds);
                row.put("lastTrackedAt", formatDate(agg.lastTrackedAt));
                return row;
            })
            .toList();

        List<Map<String, Object>> articleAgents = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : articleAgentSeconds.entrySet()) {
            String[] parts = entry.getKey().split("\\|", 2);
            if (parts.length != 2) {
                continue;
            }
            Long articleId;
            try {
                articleId = Long.parseLong(parts[0]);
            } catch (NumberFormatException ex) {
                continue;
            }
            String viewerKey = parts[1];
            AgentAgg agent = byAgent.get(viewerKey);
            ArticleAgg article = byArticle.get(articleId);
            if (agent == null || article == null) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("articleId", articleId);
            row.put("title", article.title);
            row.put("category", article.category);
            row.put("userId", agent.userId);
            row.put("name", agent.name);
            row.put("email", agent.email);
            row.put("seconds", entry.getValue());
            row.put("minutes", round2(entry.getValue() / 60.0));
            articleAgents.add(row);
        }
        articleAgents.sort((a, b) -> {
            int byArticleId = Long.compare(
                toLong(a.get("articleId")),
                toLong(b.get("articleId"))
            );
            if (byArticleId != 0) return byArticleId;
            return Integer.compare((Integer) b.get("seconds"), (Integer) a.get("seconds"));
        });

        List<Map<String, Object>> recent = logs.stream()
            .limit(200)
            .map(log -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("articleId", log.getArticleId());
                row.put("title", firstNonBlank(log.getArticleTitleSnapshot(), "Article #" + log.getArticleId()));
                row.put("category", firstNonBlank(log.getCategoryNameSnapshot(), "Uncategorized"));
                row.put("userId", log.getViewerUserId());
                row.put("name", firstNonBlank(log.getViewerName(), "Unknown"));
                row.put("email", firstNonBlank(log.getViewerEmail(), ""));
                row.put("seconds", log.getSecondsSpent());
                row.put("minutes", round2((log.getSecondsSpent() == null ? 0 : log.getSecondsSpent()) / 60.0));
                row.put("source", firstNonBlank(log.getSource(), ""));
                row.put("sessionId", firstNonBlank(log.getSessionId(), ""));
                row.put("trackedAt", formatDate(log.getTrackedAt()));
                return row;
            })
            .toList();

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("totalSeconds", totalSeconds);
        totals.put("totalMinutes", round2(totalSeconds / 60.0));
        totals.put("totalHours", round2(totalSeconds / 3600.0));
        totals.put("trackedEvents", logs.size());
        totals.put("uniqueArticles", byArticle.size());
        totals.put("uniqueUsers", byAgent.size());
        totals.put("avgMinutesPerArticle", byArticle.isEmpty() ? 0.0 : round2((totalSeconds / 60.0) / byArticle.size()));
        totals.put("avgMinutesPerUser", byAgent.isEmpty() ? 0.0 : round2((totalSeconds / 60.0) / byAgent.size()));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("periodDays", periodDays);
        response.put("generatedAt", formatDate(LocalDateTime.now()));
        response.put("totals", totals);
        response.put("articles", articles);
        response.put("agents", agents);
        response.put("articleAgents", articleAgents);
        response.put("recent", recent);
        return response;
    }

    private static String buildName(User user) {
        if (user == null) return "";
        String first = safe(user.getFirstName());
        String last = safe(user.getLastName());
        String full = (first + " " + last).trim();
        return full.isBlank() ? safe(user.getEmail()) : full;
    }

    private static String normalizeSource(String source) {
        String normalized = safe(source).toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return "knowledge_base";
        }
        if (normalized.length() > 64) {
            normalized = normalized.substring(0, 64);
        }
        return normalized;
    }

    private static boolean isAfter(LocalDateTime candidate, LocalDateTime current) {
        if (candidate == null) return false;
        if (current == null) return true;
        return candidate.isAfter(current);
    }

    private static String viewerKey(KbArticleTimeLog log) {
        if (log.getViewerUserId() != null && log.getViewerUserId() > 0) {
            return "u:" + log.getViewerUserId();
        }
        String email = safe(log.getViewerEmail()).toLowerCase(Locale.ROOT);
        if (!email.isBlank()) {
            return "e:" + email;
        }
        String session = safe(log.getSessionId());
        if (!session.isBlank()) {
            return "s:" + session;
        }
        return "id:" + String.valueOf(log.getId());
    }

    private static String firstNonBlank(String value, String fallback) {
        String text = safe(value);
        return text.isBlank() ? fallback : text;
    }

    private static String formatDate(LocalDateTime value) {
        if (value == null) return "";
        return ISO.format(value);
    }

    private static String trim(String value, int max) {
        String text = safe(value);
        if (text.isBlank()) return null;
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception ex) {
            return 0L;
        }
    }

    private static class ArticleAgg {
        private final Long articleId;
        private final String title;
        private final String category;
        private long totalSeconds = 0L;
        private long eventCount = 0L;
        private LocalDateTime lastTrackedAt;
        private final Set<String> viewerKeys = new HashSet<>();

        private ArticleAgg(Long articleId, String title, String category) {
            this.articleId = articleId;
            this.title = title;
            this.category = category;
        }
    }

    private static class AgentAgg {
        private final Long userId;
        private final String name;
        private final String email;
        private long totalSeconds = 0L;
        private final Set<Long> articleIds = new HashSet<>();
        private LocalDateTime lastTrackedAt;
        private final Map<Long, Integer> secondsByArticle = new HashMap<>();

        private AgentAgg(Long userId, String name, String email) {
            this.userId = userId;
            this.name = name;
            this.email = email;
        }
    }
}
