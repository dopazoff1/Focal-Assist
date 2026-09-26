package com.crdpls.api.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "astra_kb_article_feedback",
    indexes = {
        @Index(name = "idx_astra_feedback_article", columnList = "article_id"),
        @Index(name = "idx_astra_feedback_created", columnList = "created_at"),
        @Index(name = "idx_astra_feedback_sentiment", columnList = "sentiment")
    }
)
public class AstraKbArticleFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "article_id", nullable = false)
    private KbArticle article;

    @Column(name = "viewer_user_id")
    private Long viewerUserId;

    @Column(name = "viewer_email", length = 255)
    private String viewerEmail;

    @Column(name = "viewer_name", length = 180)
    private String viewerName;

    @Column(name = "sentiment", nullable = false, length = 12)
    private String sentiment;

    @Lob
    @Column(name = "feedback_text", columnDefinition = "LONGTEXT")
    private String feedbackText;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public KbArticle getArticle() {
        return article;
    }

    public void setArticle(KbArticle article) {
        this.article = article;
    }

    public Long getViewerUserId() {
        return viewerUserId;
    }

    public void setViewerUserId(Long viewerUserId) {
        this.viewerUserId = viewerUserId;
    }

    public String getViewerEmail() {
        return viewerEmail;
    }

    public void setViewerEmail(String viewerEmail) {
        this.viewerEmail = viewerEmail;
    }

    public String getViewerName() {
        return viewerName;
    }

    public void setViewerName(String viewerName) {
        this.viewerName = viewerName;
    }

    public String getSentiment() {
        return sentiment;
    }

    public void setSentiment(String sentiment) {
        this.sentiment = sentiment;
    }

    public String getFeedbackText() {
        return feedbackText;
    }

    public void setFeedbackText(String feedbackText) {
        this.feedbackText = feedbackText;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}

