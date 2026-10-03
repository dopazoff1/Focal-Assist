package com.focal.api.service;

import com.focal.api.dto.KbArticleCreateRequestDto;
import com.focal.api.dto.KbArticleDraftRequestDto;
import com.focal.api.models.KbArticle;
import com.focal.api.models.KbCategory;
import com.focal.api.models.User;
import com.focal.api.repository.KbArticleRepository;
import com.focal.api.repository.KbCategoryRepository;
import com.focal.api.repository.KbMapEdgeRepository;
import com.focal.api.repository.KbMapNodeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class KbArticleService {

    private final KbArticleRepository articleRepository;
    private final KbCategoryRepository categoryRepository;
    private final KbMapNodeRepository kbMapNodeRepository;
    private final KbMapEdgeRepository kbMapEdgeRepository;
    private final KbValidationService validationService;

    public KbArticleService(
            KbArticleRepository articleRepository,
            KbCategoryRepository categoryRepository,
            KbMapNodeRepository kbMapNodeRepository,
            KbMapEdgeRepository kbMapEdgeRepository,
            KbValidationService validationService
    ) {
        this.articleRepository = articleRepository;
        this.categoryRepository = categoryRepository;
        this.kbMapNodeRepository = kbMapNodeRepository;
        this.kbMapEdgeRepository = kbMapEdgeRepository;
        this.validationService = validationService;
    }

    public List<KbArticle> getArticlesByCategory(Long categoryId) {
        return articleRepository.findByCategoryIdAndIsActiveTrueOrderByDisplayOrderAsc(categoryId);
    }

    public List<KbArticle> getArticlesByCategory(Long categoryId, boolean includeInactive) {
        if (includeInactive) {
            return articleRepository.findByCategoryIdOrderByDisplayOrderAsc(categoryId);
        }
        return articleRepository.findByCategoryIdAndIsActiveTrueOrderByDisplayOrderAsc(categoryId);
    }

    public List<KbArticle> getAllArticles() {
        return articleRepository.findAllByOrderByDisplayOrderAscIdAsc();
    }

    public KbArticle getArticleById(Long id) {
        return articleRepository.findById(id).orElse(null);
    }

    public KbArticle createArticle(KbArticleCreateRequestDto request, User maker) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required.");
        }

        if (request.getCategoryId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "categoryId is required.");
        }

        String title = request.getTitle() != null ? request.getTitle().trim() : "";
        if (title.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title is required.");
        }

        KbCategory category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid categoryId."));

        KbArticle article = new KbArticle();
        article.setCategory(category);
        article.setTitle(title);
        article.setContent(request.getContent() != null ? request.getContent() : "");
        article.setDisplayOrder(request.getDisplayOrder() != null ? request.getDisplayOrder() : 0);
        // New content exists as an unpublished shell until a revision is approved.
        article.setIsActive(false);
        KbArticle saved = articleRepository.save(article);
        validationService.createInitialDraft(
                maker, saved, title, article.getContent(), category, article.getDisplayOrder(),
                request.getIsActive() == null || request.getIsActive());
        return saved;
    }

    public KbArticle updateArticle(Long id, KbArticleCreateRequestDto request, User maker) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required.");
        }

        KbArticle article = articleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Article not found."));

        if (request.getCategoryId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "categoryId is required.");
        }
        KbCategory category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid categoryId."));

        String title = request.getTitle() != null ? request.getTitle().trim() : "";
        if (title.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title is required.");
        }

        validationService.saveDraft(maker, id, toDraftRequest(request));
        return article;
    }

    public KbArticle setArticleActive(Long id, boolean active) {
        if (active) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Articles are published by validation approval.");
        }
        KbArticle article = articleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Article not found."));
        article.setIsActive(active);
        return articleRepository.save(article);
    }

    public KbArticle duplicateArticle(Long id, User maker) {
        KbArticle source = articleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Article not found."));

        KbArticle copy = new KbArticle();
        copy.setCategory(source.getCategory());
        copy.setTitle(source.getTitle() + " (Copy)");
        copy.setContent(source.getContent() != null ? source.getContent() : "");
        copy.setDisplayOrder(source.getDisplayOrder() != null ? source.getDisplayOrder() : 0);
        copy.setIsActive(false);
        KbArticle saved = articleRepository.save(copy);
        validationService.createInitialDraft(
                maker, saved, copy.getTitle(), copy.getContent(), copy.getCategory(), copy.getDisplayOrder(),
                Boolean.TRUE.equals(source.getIsActive()));
        return saved;
    }

    @Transactional
    public void deleteArticle(Long id) {
        if (!articleRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Article not found.");
        }
        kbMapEdgeRepository.deleteByArticleId(id);
        kbMapNodeRepository.deleteByArticleId(id);
        validationService.deleteRevisionsForArticle(id);
        articleRepository.deleteById(id);
    }

    private KbArticleDraftRequestDto toDraftRequest(KbArticleCreateRequestDto request) {
        KbArticleDraftRequestDto draft = new KbArticleDraftRequestDto();
        draft.setCategoryId(request.getCategoryId());
        draft.setTitle(request.getTitle());
        draft.setContent(request.getContent());
        draft.setDisplayOrder(request.getDisplayOrder());
        draft.setRequestedActive(request.getIsActive());
        return draft;
    }
}
