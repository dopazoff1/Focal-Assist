package com.crdpls.api.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "kb_article_time_logs",
    indexes = {
        @Index(name = "idx_kb_time_article", columnList = "article_id"),
        @Index(name = "idx_kb_time_user", columnList = "viewer_user_id"),
        @Index(name = "idx_kb_time_tracked", columnList = "tracked_at"),
        @Index(name = "idx_kb_time_session", columnList = "session_id")
    }
)
public class KbArticleTimeLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "article_id", nullable = false)
    private Long articleId;

    @Column(name = "article_title_snapshot", length = 255)
    private String articleTitleSnapshot;

    @Column(name = "category_name_snapshot", length = 255)
    private String categoryNameSnapshot;

    @Column(name = "viewer_user_id")
    private Long viewerUserId;

    @Column(name = "viewer_email", length = 255)
    private String viewerEmail;

    @Column(name = "viewer_name", length = 180)
    private String viewerName;

    @Column(name = "session_id", length = 120)
    private String sessionId;

    @Column(name = "source", length = 64)
    private String source;

    @Column(name = "seconds_spent", nullable = false)
    private Integer secondsSpent;

    @Column(name = "tracked_at", nullable = false)
    private LocalDateTime trackedAt;

    @PrePersist
    public void prePersist() {
        if (trackedAt == null) {
            trackedAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getArticleId() {
        return articleId;
    }

    public void setArticleId(Long articleId) {
        this.articleId = articleId;
    }

    public String getArticleTitleSnapshot() {
        return articleTitleSnapshot;
    }

    public void setArticleTitleSnapshot(String articleTitleSnapshot) {
        this.articleTitleSnapshot = articleTitleSnapshot;
    }

    public String getCategoryNameSnapshot() {
        return categoryNameSnapshot;
    }

    public void setCategoryNameSnapshot(String categoryNameSnapshot) {
        this.categoryNameSnapshot = categoryNameSnapshot;
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

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Integer getSecondsSpent() {
        return secondsSpent;
    }

    public void setSecondsSpent(Integer secondsSpent) {
        this.secondsSpent = secondsSpent;
    }

    public LocalDateTime getTrackedAt() {
        return trackedAt;
    }

    public void setTrackedAt(LocalDateTime trackedAt) {
        this.trackedAt = trackedAt;
    }
}
