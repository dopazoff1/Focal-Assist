package com.focal.api.service;

import com.focal.api.dto.KbHubArticleSummaryDto;
import com.focal.api.dto.KbHubCategoryDto;
import com.focal.api.dto.KbHubIndexDto;
import com.focal.api.dto.KbHubSearchResultDto;
import com.focal.api.models.KbArticle;
import com.focal.api.models.KbCategory;
import com.focal.api.models.KbMapEdge;
import com.focal.api.models.KbMapNode;
import com.focal.api.repository.KbArticleRepository;
import com.focal.api.repository.KbArticleSummaryProjection;
import com.focal.api.repository.KbCategoryRepository;
import com.focal.api.repository.KbMapEdgeRepository;
import com.focal.api.repository.KbMapNodeRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class KbHubService {

    private static final int DEFAULT_SEARCH_LIMIT = 7;
    private static final int MAX_SEARCH_LIMIT = 50;

    private final KbArticleRepository articleRepository;
    private final KbCategoryRepository categoryRepository;
    private final KbMapNodeRepository mapNodeRepository;
    private final KbMapEdgeRepository mapEdgeRepository;

    public KbHubService(
            KbArticleRepository articleRepository,
            KbCategoryRepository categoryRepository,
            KbMapNodeRepository mapNodeRepository,
            KbMapEdgeRepository mapEdgeRepository
    ) {
        this.articleRepository = articleRepository;
        this.categoryRepository = categoryRepository;
        this.mapNodeRepository = mapNodeRepository;
        this.mapEdgeRepository = mapEdgeRepository;
    }

    @Transactional(readOnly = true)
    public KbHubIndexDto getIndex() {
        List<KbCategory> categories = categoryRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
        List<KbArticleSummaryProjection> projections = articleRepository.findActiveHubSummaries();
        List<Long> articleIds = projections.stream().map(KbArticleSummaryProjection::getId).toList();
        Set<Long> articlesWithMaps = articleIds.isEmpty()
                ? Collections.emptySet()
                : new HashSet<>(mapNodeRepository.findArticleIdsWithNodes(articleIds));

        List<KbHubArticleSummaryDto> articles = projections.stream()
                .map(projection -> toSummary(projection, articlesWithMaps.contains(projection.getId())))
                .toList();

        Map<Long, Long> countsByCategory = articles.stream()
                .collect(Collectors.groupingBy(KbHubArticleSummaryDto::categoryId, Collectors.counting()));
        List<KbHubCategoryDto> categoryDtos = categories.stream()
                .map(category -> new KbHubCategoryDto(
                        category.getId(),
                        category.getName(),
                        countsByCategory.getOrDefault(category.getId(), 0L)
                ))
                .toList();

        return new KbHubIndexDto(categoryDtos, articles);
    }

    @Transactional(readOnly = true)
    public List<KbHubSearchResultDto> search(String query, int requestedLimit) {
        String term = query == null ? "" : query.trim();
        if (term.isEmpty()) return List.of();

        int limit = Math.min(MAX_SEARCH_LIMIT, Math.max(1, requestedLimit > 0 ? requestedLimit : DEFAULT_SEARCH_LIMIT));
        List<KbArticle> matches = articleRepository.searchActiveHubArticles(term, PageRequest.of(0, limit));
        if (matches.isEmpty()) return List.of();

        List<Long> articleIds = matches.stream().map(KbArticle::getId).toList();
        List<KbMapNode> nodes = mapNodeRepository.findByArticleIds(articleIds);
        List<KbMapEdge> edges = mapEdgeRepository.findByArticleIds(articleIds);
        Map<Long, List<KbMapNode>> nodesByArticle = nodes.stream()
                .collect(Collectors.groupingBy(node -> node.getArticle().getId()));
        Map<Long, List<KbMapEdge>> edgesByArticle = edges.stream()
                .collect(Collectors.groupingBy(edge -> edge.getArticle().getId()));
        Set<Long> articlesWithMaps = nodes.stream().map(node -> node.getArticle().getId()).collect(Collectors.toSet());

        return matches.stream()
                .map(article -> {
                    KbCategory category = article.getCategory();
                    return new KbHubSearchResultDto(
                            article.getId(),
                            article.getTitle(),
                            category == null ? null : category.getId(),
                            category == null ? "Uncategorized" : category.getName(),
                            article.getDisplayOrder(),
                            article.getIsActive(),
                            articlesWithMaps.contains(article.getId()),
                            buildSnippet(article, term, nodesByArticle.get(article.getId()), edgesByArticle.get(article.getId()))
                    );
                })
                .toList();
    }

    private KbHubArticleSummaryDto toSummary(KbArticleSummaryProjection projection, boolean hasMap) {
        return new KbHubArticleSummaryDto(
                projection.getId(),
                projection.getTitle(),
                projection.getCategoryId(),
                projection.getCategoryName(),
                projection.getDisplayOrder(),
                projection.getIsActive(),
                hasMap
        );
    }

    private String buildSnippet(KbArticle article, String term, List<KbMapNode> nodes, List<KbMapEdge> edges) {
        List<String> candidates = new ArrayList<>();
        candidates.add(article.getContent());
        if (article.getCategory() != null) candidates.add(article.getCategory().getName());
        if (nodes != null) {
            for (KbMapNode node : nodes) {
                candidates.add(node.getTitle());
                candidates.add(node.getLabel());
                candidates.add(node.getContent());
            }
        }
        if (edges != null) {
            for (KbMapEdge edge : edges) candidates.add(edge.getLabel());
        }

        String normalizedTerm = term.toLowerCase(Locale.ROOT);
        String selected = candidates.stream()
                .map(this::plainText)
                .filter(value -> value.toLowerCase(Locale.ROOT).contains(normalizedTerm))
                .findFirst()
                .orElseGet(() -> plainText(article.getTitle()));
        int matchIndex = selected.toLowerCase(Locale.ROOT).indexOf(normalizedTerm);
        if (matchIndex < 0) return selected.substring(0, Math.min(160, selected.length()));

        int start = Math.max(0, matchIndex - 42);
        int end = Math.min(selected.length(), matchIndex + normalizedTerm.length() + 105);
        return (start > 0 ? "... " : "") + selected.substring(start, end) + (end < selected.length() ? " ..." : "");
    }

    private String plainText(String value) {
        if (value == null || value.isBlank()) return "";
        return value
                .replaceAll("<[^>]*>", " ")
                .replaceAll("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
