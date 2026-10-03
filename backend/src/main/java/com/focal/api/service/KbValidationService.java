package com.focal.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.focal.api.dto.*;
import com.focal.api.models.*;
import com.focal.api.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class KbValidationService {
    public static final String FEATURE_KEY = "kb_article_validation";
    public static final String CHAIN_FEATURE_KEY = "kb_validation_chain";
    private static final List<KbRevisionStatus> EDITABLE_STATUSES = List.of(
            KbRevisionStatus.DRAFT, KbRevisionStatus.CHANGES_REQUESTED);

    private final KbArticleRepository articleRepository;
    private final KbArticleRevisionRepository revisionRepository;
    private final KbValidationStepRepository stepRepository;
    private final KbValidationChainStepRepository chainStepRepository;
    private final KbValidationCommentRepository commentRepository;
    private final KbCategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final RoleAccessService roleAccessService;
    private final KbMapNodeRepository mapNodeRepository;
    private final KbMapEdgeRepository mapEdgeRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public KbValidationService(
            KbArticleRepository articleRepository,
            KbArticleRevisionRepository revisionRepository,
            KbValidationStepRepository stepRepository,
            KbValidationChainStepRepository chainStepRepository,
            KbValidationCommentRepository commentRepository,
            KbCategoryRepository categoryRepository,
            UserRepository userRepository,
            RoleAccessService roleAccessService,
            KbMapNodeRepository mapNodeRepository,
            KbMapEdgeRepository mapEdgeRepository
    ) {
        this.articleRepository = articleRepository;
        this.revisionRepository = revisionRepository;
        this.stepRepository = stepRepository;
        this.chainStepRepository = chainStepRepository;
        this.commentRepository = commentRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.roleAccessService = roleAccessService;
        this.mapNodeRepository = mapNodeRepository;
        this.mapEdgeRepository = mapEdgeRepository;
    }

    @Transactional(readOnly = true)
    public List<KbValidationUserDto> eligibleUsers(User requester) {
        requireFeatureOrArticleManager(requester);
        return userRepository.findByActiveTrueOrderByFirstNameAscLastNameAsc().stream()
                .filter(user -> !user.getId().equals(requester.getId()))
                .filter(user -> roleAccessService.hasFeatureAccess(user, FEATURE_KEY))
                .map(this::toUserDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<KbValidationStepDto> getGlobalChain(User requester) {
        requireChainFeature(requester);
        return chainStepRepository.findAllByOrderByStepOrderAsc().stream()
                .map(step -> new KbValidationStepDto(step.getId(), step.getStepOrder(), toUserDto(step.getReviewer())))
                .toList();
    }

    @Transactional
    public List<KbValidationStepDto> saveGlobalChain(User requester, KbValidationChainRequestDto request) {
        requireChainFeature(requester);
        List<Long> requestedIds = request == null || request.getReviewerUserIds() == null
                ? List.of() : request.getReviewerUserIds();
        Map<Long, User> users = userRepository.findAllById(requestedIds).stream()
                .collect(Collectors.toMap(User::getId, user -> user));
        Set<Long> seen = new HashSet<>();
        List<User> reviewers = new ArrayList<>();
        for (Long userId : requestedIds) {
            if (userId == null || !seen.add(userId)) throw badRequest("A validator cannot appear twice in the chain.");
            User reviewer = users.get(userId);
            if (reviewer == null || !Boolean.TRUE.equals(reviewer.getActive())
                    || !roleAccessService.hasFeatureAccess(reviewer, FEATURE_KEY)) {
                throw badRequest("Every validator must be an active user with KB Article Validation access.");
            }
            reviewers.add(reviewer);
        }
        chainStepRepository.deleteAllInBatch();
        for (int index = 0; index < reviewers.size(); index++) {
            KbValidationChainStep step = new KbValidationChainStep();
            step.setReviewer(reviewers.get(index));
            step.setStepOrder(index);
            chainStepRepository.save(step);
        }
        return getGlobalChain(requester);
    }

    @Transactional
    public KbArticleRevision createInitialDraft(User maker, KbArticle article, String title, String content,
                                                 KbCategory category, Integer displayOrder, Boolean requestedActive) {
        KbArticleRevision revision = new KbArticleRevision();
        revision.setArticle(article);
        revision.setCreatedBy(maker);
        revision.setTitle(title);
        revision.setContent(content == null ? "" : content);
        revision.setCategory(category);
        revision.setDisplayOrder(displayOrder == null ? 0 : displayOrder);
        revision.setRequestedActive(requestedActive == null || requestedActive);
        revision.setStatus(KbRevisionStatus.DRAFT);
        revision.setCurrentStep(0);
        return revisionRepository.save(revision);
    }

    @Transactional
    public KbArticleDraftDto saveDraft(User maker, Long articleId, KbArticleDraftRequestDto request) {
        requireFeatureOrArticleManager(maker);
        if (request == null) throw badRequest("Draft body is required.");
        KbArticle article = articleRepository.findById(articleId)
                .orElseThrow(() -> notFound("Article not found."));
        String title = request.getTitle() == null ? "" : request.getTitle().trim();
        if (title.isEmpty()) throw badRequest("Title is required.");
        if (request.getCategoryId() == null) throw badRequest("categoryId is required.");
        KbCategory category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> badRequest("Invalid categoryId."));

        KbArticleRevision revision = revisionRepository
                .findFirstByArticleIdAndCreatedByIdAndStatusInOrderByIdDesc(articleId, maker.getId(), EDITABLE_STATUSES)
                .orElseGet(KbArticleRevision::new);
        if (revision.getId() == null) {
            revision.setArticle(article);
            revision.setCreatedBy(maker);
        }
        revision.setTitle(title);
        revision.setContent(request.getContent() == null ? "" : request.getContent());
        revision.setCategory(category);
        revision.setDisplayOrder(request.getDisplayOrder() == null ? 0 : request.getDisplayOrder());
        revision.setRequestedActive(request.getRequestedActive() == null || request.getRequestedActive());
        revision.setStatus(KbRevisionStatus.DRAFT);
        revision.setCurrentStep(0);
        revision.setRejectionReason(null);
        revision.setSubmittedAt(null);
        revision.setDecidedAt(null);

        return toDto(revisionRepository.save(revision));
    }

    @Transactional(readOnly = true)
    public KbArticleDraftDto getDraftForEditor(User maker, Long articleId) {
        requireFeatureOrArticleManager(maker);
        KbArticle article = articleRepository.findById(articleId)
                .orElseThrow(() -> notFound("Article not found."));
        KbArticleRevision revision = revisionRepository
                .findFirstByArticleIdAndCreatedByIdAndStatusInOrderByIdDesc(articleId, maker.getId(), EDITABLE_STATUSES)
                .orElseGet(() -> revisionRepository.findFirstByArticleIdAndStatusInOrderByIdDesc(articleId, EDITABLE_STATUSES).orElse(null));
        if (revision != null) return toDto(revision);
        return new KbArticleDraftDto(
                null, article.getId(), article.getTitle(), article.getContent(),
                article.getCategory() == null ? null : article.getCategory().getId(),
                article.getCategory() == null ? "" : article.getCategory().getName(),
                article.getDisplayOrder(), article.getIsActive(), null, 0, null, null,
                List.of(), List.of());
    }

    @Transactional
    public KbArticleDraftDto submit(User maker, Long revisionId) {
        KbArticleRevision revision = revisionRepository.findByIdForUpdate(revisionId)
                .orElseThrow(() -> notFound("Validation draft not found."));
        if (!revision.getCreatedBy().getId().equals(maker.getId())) throw forbidden("Only the article maker can submit this draft.");
        if (!EDITABLE_STATUSES.contains(revision.getStatus())) throw badRequest("This draft is not editable.");
        List<KbValidationStep> steps = snapshotGlobalChain(revision);
        if (steps.isEmpty()) throw badRequest("Add at least one validator before submitting.");
        revision.setStatus(KbRevisionStatus.PENDING_REVIEW);
        revision.setCurrentStep(0);
        revision.setSubmittedAt(LocalDateTime.now());
        revision.setDecidedAt(null);
        revision.setRejectionReason(null);
        return toDto(revisionRepository.save(revision));
    }

    @Transactional
    public KbArticleDraftDto saveMapDraft(User maker, Long articleId, KbMapSaveRequestDto request) {
        requireFeatureOrArticleManager(maker);
        KbArticle article = articleRepository.findById(articleId)
                .orElseThrow(() -> notFound("Article not found."));
        KbArticleRevision revision = revisionRepository
                .findFirstByArticleIdAndCreatedByIdAndStatusInOrderByIdDesc(articleId, maker.getId(), EDITABLE_STATUSES)
                .orElseGet(() -> {
                    KbArticleRevision draft = new KbArticleRevision();
                    draft.setArticle(article);
                    draft.setCreatedBy(maker);
                    draft.setTitle(article.getTitle());
                    draft.setContent(article.getContent() == null ? "" : article.getContent());
                    draft.setCategory(article.getCategory());
                    draft.setDisplayOrder(article.getDisplayOrder());
                    draft.setRequestedActive(article.getIsActive());
                    draft.setStatus(KbRevisionStatus.DRAFT);
                    draft.setCurrentStep(0);
                    return draft;
                });
        try {
            revision.setMapJson(objectMapper.writeValueAsString(request == null ? new KbMapSaveRequestDto() : request));
        } catch (Exception ex) {
            throw badRequest("Map payload could not be stored in the draft.");
        }
        return toDto(revisionRepository.save(revision));
    }

    @Transactional(readOnly = true)
    public List<KbValidationQueueItemDto> queue(User reviewer) {
        requireFeature(reviewer);
        return stepRepository.findCurrentQueueForReviewer(reviewer.getId()).stream()
                .map(step -> {
                    KbArticleRevision revision = step.getRevision();
                    int total = stepRepository.findByRevisionIdOrderByStepOrderAsc(revision.getId()).size();
                    return new KbValidationQueueItemDto(
                            revision.getId(), revision.getArticle().getId(), revision.getTitle(),
                            revision.getCategory().getName(), fullName(revision.getCreatedBy()),
                            revision.getSubmittedAt(), revision.getCurrentStep(), total);
                }).toList();
    }

    @Transactional(readOnly = true)
    public KbArticleDraftDto detail(User reviewer, Long revisionId) {
        KbArticleRevision revision = getRevision(revisionId);
        requireParticipant(reviewer, revision);
        return toDto(revision);
    }

    @Transactional
    public KbArticleDraftDto addComment(User reviewer, Long revisionId, KbValidationCommentRequestDto request) {
        KbArticleRevision revision = getRevision(revisionId);
        requireCurrentReviewer(reviewer, revision);
        if (request == null || request.getComment() == null || request.getComment().trim().isEmpty()) {
            throw badRequest("Comment text is required.");
        }
        KbValidationComment comment = new KbValidationComment();
        comment.setRevision(revision);
        comment.setAuthor(reviewer);
        comment.setSelector(trim(request.getSelector(), 500));
        comment.setSelectedText(trim(request.getSelectedText(), 2000));
        comment.setComment(trim(request.getComment(), 4000));
        commentRepository.save(comment);
        return toDto(revision);
    }

    @Transactional
    public KbArticleDraftDto approve(User reviewer, Long revisionId) {
        KbArticleRevision revision = getRevision(revisionId);
        requireCurrentReviewer(reviewer, revision);
        List<KbValidationStep> steps = stepRepository.findByRevisionIdOrderByStepOrderAsc(revisionId);
        int next = revision.getCurrentStep() + 1;
        if (next < steps.size()) {
            revision.setCurrentStep(next);
            return toDto(revisionRepository.save(revision));
        }

        KbArticle article = revision.getArticle();
        article.setTitle(revision.getTitle());
        article.setContent(revision.getContent());
        article.setCategory(revision.getCategory());
        article.setDisplayOrder(revision.getDisplayOrder());
        article.setIsActive(revision.getRequestedActive());
        articleRepository.save(article);
        publishMapIfChanged(revision);
        revision.setStatus(KbRevisionStatus.APPROVED);
        revision.setDecidedAt(LocalDateTime.now());
        revisionRepository.save(revision);
        return toDto(revision);
    }

    @Transactional
    public KbArticleDraftDto reject(User reviewer, Long revisionId, KbValidationCommentRequestDto request) {
        KbArticleRevision revision = getRevision(revisionId);
        requireCurrentReviewer(reviewer, revision);
        if (request == null || request.getComment() == null || request.getComment().trim().isEmpty()) {
            throw badRequest("A rejection reason is required.");
        }
        addComment(reviewer, revisionId, request);
        revision.setStatus(KbRevisionStatus.CHANGES_REQUESTED);
        revision.setCurrentStep(0);
        revision.setRejectionReason(trim(request.getComment(), 2000));
        revision.setDecidedAt(LocalDateTime.now());
        return toDto(revisionRepository.save(revision));
    }

    @Transactional
    public void deleteRevisionsForArticle(Long articleId) {
        for (KbArticleRevision revision : revisionRepository.findByArticleIdOrderByIdAsc(articleId)) {
            commentRepository.deleteAll(commentRepository.findByRevisionIdOrderByCreatedAtAscIdAsc(revision.getId()));
            stepRepository.deleteByRevisionId(revision.getId());
            revisionRepository.delete(revision);
        }
    }

    private List<KbValidationStep> snapshotGlobalChain(KbArticleRevision revision) {
        stepRepository.deleteByRevisionId(revision.getId());
        stepRepository.flush();
        List<KbValidationChainStep> configuredSteps = chainStepRepository.findAllByOrderByStepOrderAsc();
        List<KbValidationStep> steps = new ArrayList<>();
        int order = 0;
        for (KbValidationChainStep configuredStep : configuredSteps) {
            KbValidationStep step = new KbValidationStep();
            step.setRevision(revision);
            step.setReviewer(configuredStep.getReviewer());
            step.setStepOrder(order++);
            steps.add(stepRepository.save(step));
        }
        return steps;
    }

    private void publishMapIfChanged(KbArticleRevision revision) {
        if (revision.getMapJson() == null || revision.getMapJson().isBlank()) return;
        final KbMapSaveRequestDto request;
        try {
            request = objectMapper.readValue(revision.getMapJson(), KbMapSaveRequestDto.class);
        } catch (Exception ex) {
            throw badRequest("The draft contains an invalid map payload.");
        }
        List<KbMapNodeDto> nodes = request.getNodes() == null ? List.of() : request.getNodes();
        List<KbMapEdgeDto> edges = request.getEdges() == null ? List.of() : request.getEdges();
        mapEdgeRepository.deleteByArticleId(revision.getArticle().getId());
        mapNodeRepository.deleteByArticleId(revision.getArticle().getId());

        Map<Long, Long> nodeIdMap = new HashMap<>();
        List<KbMapNode> savedNodes = new ArrayList<>();
        long syntheticKey = -1L;
        for (KbMapNodeDto dto : nodes) {
            if (dto == null) continue;
            KbMapNode node = new KbMapNode();
            node.setArticle(revision.getArticle());
            node.setTitle(dto.getTitle());
            node.setLabel(dto.getLabel());
            node.setContent(dto.getContent());
            node.setXPos(dto.getXPos());
            node.setYPos(dto.getYPos());
            node.setIsStart(Boolean.TRUE.equals(dto.getIsStart()));
            KbMapNode saved = mapNodeRepository.save(node);
            savedNodes.add(saved);
            Long clientId = dto.getId();
            nodeIdMap.put(clientId != null && clientId > 0 ? clientId : syntheticKey--, saved.getId());
        }
        int fallbackOrder = 1;
        for (KbMapEdgeDto dto : edges) {
            if (dto == null) continue;
            Long sourceId = mapNodeId(dto.getSourceNodeId(), nodeIdMap);
            Long targetId = mapNodeId(dto.getTargetNodeId(), nodeIdMap);
            if (sourceId == null || targetId == null) throw badRequest("The draft contains an invalid map connection.");
            KbMapEdge edge = new KbMapEdge();
            edge.setArticle(revision.getArticle());
            edge.setSourceNodeId(sourceId);
            edge.setTargetNodeId(targetId);
            edge.setLabel(dto.getLabel());
            edge.setDisplayOrder(dto.getDisplayOrder() == null ? fallbackOrder : dto.getDisplayOrder());
            fallbackOrder++;
            mapEdgeRepository.save(edge);
        }
    }

    private Long mapNodeId(Long clientNodeId, Map<Long, Long> nodeIdMap) {
        if (clientNodeId == null) return null;
        Long mapped = nodeIdMap.get(clientNodeId);
        if (mapped != null) return mapped;
        return nodeIdMap.containsValue(clientNodeId) ? clientNodeId : null;
    }

    private KbArticleDraftDto toDto(KbArticleRevision revision) {
        List<KbValidationStepDto> steps = stepRepository.findByRevisionIdOrderByStepOrderAsc(revision.getId()).stream()
                .map(step -> new KbValidationStepDto(step.getId(), step.getStepOrder(), toUserDto(step.getReviewer())))
                .toList();
        List<KbValidationCommentDto> comments = commentRepository.findByRevisionIdOrderByCreatedAtAscIdAsc(revision.getId()).stream()
                .map(comment -> new KbValidationCommentDto(
                        comment.getId(), comment.getSelector(), comment.getSelectedText(), comment.getComment(),
                        toUserDto(comment.getAuthor()), comment.getCreatedAt()))
                .toList();
        return new KbArticleDraftDto(
                revision.getId(), revision.getArticle().getId(), revision.getTitle(), revision.getContent(),
                revision.getCategory().getId(), revision.getCategory().getName(), revision.getDisplayOrder(),
                revision.getRequestedActive(), revision.getStatus(), revision.getCurrentStep(),
                revision.getRejectionReason(), revision.getSubmittedAt(), steps, comments);
    }

    private KbArticleRevision getRevision(Long revisionId) {
        return revisionRepository.findById(revisionId)
                .orElseThrow(() -> notFound("Validation draft not found."));
    }

    private void requireParticipant(User user, KbArticleRevision revision) {
        requireFeature(user);
        boolean maker = revision.getCreatedBy().getId().equals(user.getId());
        boolean reviewer = stepRepository.findByRevisionIdOrderByStepOrderAsc(revision.getId()).stream()
                .anyMatch(step -> step.getReviewer().getId().equals(user.getId()));
        if (!maker && !reviewer) throw forbidden("You are not part of this validation chain.");
    }

    private void requireCurrentReviewer(User user, KbArticleRevision revision) {
        requireFeature(user);
        if (revision.getStatus() != KbRevisionStatus.PENDING_REVIEW) throw badRequest("This revision is not awaiting review.");
        KbValidationStep current = stepRepository.findByRevisionIdOrderByStepOrderAsc(revision.getId()).stream()
                .filter(step -> Objects.equals(step.getStepOrder(), revision.getCurrentStep()))
                .findFirst().orElseThrow(() -> badRequest("The validation chain is incomplete."));
        if (!current.getReviewer().getId().equals(user.getId())) throw forbidden("This revision is assigned to another validator.");
    }

    private void requireFeature(User user) {
        if (!roleAccessService.hasFeatureAccess(user, FEATURE_KEY)) throw forbidden("KB Article Validation access is required.");
    }

    private void requireFeatureOrArticleManager(User user) {
        if (!roleAccessService.hasFeatureAccess(user, "article_management")
                && !roleAccessService.hasFeatureAccess(user, FEATURE_KEY)
                && !roleAccessService.hasFeatureAccess(user, CHAIN_FEATURE_KEY)) {
            throw forbidden("Article management access is required.");
        }
    }

    private void requireChainFeature(User user) {
        if (!roleAccessService.hasFeatureAccess(user, CHAIN_FEATURE_KEY)) {
            throw forbidden("Validation Chain Builder access is required.");
        }
    }

    private KbValidationUserDto toUserDto(User user) {
        return new KbValidationUserDto(user.getId(), fullName(user), user.getEmail(), user.getRole());
    }

    private String fullName(User user) {
        return ((user.getFirstName() == null ? "" : user.getFirstName()) + " "
                + (user.getLastName() == null ? "" : user.getLastName())).trim();
    }

    private String trim(String value, int max) {
        if (value == null) return null;
        String out = value.trim();
        return out.length() > max ? out.substring(0, max) : out;
    }

    private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private ResponseStatusException forbidden(String message) { return new ResponseStatusException(HttpStatus.FORBIDDEN, message); }
    private ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }
}
