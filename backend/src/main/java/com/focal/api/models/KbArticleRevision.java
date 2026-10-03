package com.focal.api.models;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "kb_article_revisions", indexes = {
        @Index(name = "idx_kb_revision_article_status", columnList = "article_id,status"),
        @Index(name = "idx_kb_revision_creator_status", columnList = "created_by,status")
})
public class KbArticleRevision {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "article_id", nullable = false)
    private KbArticle article;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private KbCategory category;

    @Column(nullable = false, length = 255)
    private String title;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String content;

    @Lob
    @Column(name = "map_json", columnDefinition = "LONGTEXT")
    private String mapJson;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "requested_active", nullable = false)
    private Boolean requestedActive = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private KbRevisionStatus status = KbRevisionStatus.DRAFT;

    @Column(name = "current_step", nullable = false)
    private Integer currentStep = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "rejection_reason", length = 2000)
    private String rejectionReason;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public KbArticle getArticle() { return article; }
    public void setArticle(KbArticle article) { this.article = article; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    public KbCategory getCategory() { return category; }
    public void setCategory(KbCategory category) { this.category = category; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getMapJson() { return mapJson; }
    public void setMapJson(String mapJson) { this.mapJson = mapJson; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
    public Boolean getRequestedActive() { return requestedActive; }
    public void setRequestedActive(Boolean requestedActive) { this.requestedActive = requestedActive; }
    public KbRevisionStatus getStatus() { return status; }
    public void setStatus(KbRevisionStatus status) { this.status = status; }
    public Integer getCurrentStep() { return currentStep; }
    public void setCurrentStep(Integer currentStep) { this.currentStep = currentStep; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setDecidedAt(LocalDateTime decidedAt) { this.decidedAt = decidedAt; }
    public LocalDateTime getDecidedAt() { return decidedAt; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
}
