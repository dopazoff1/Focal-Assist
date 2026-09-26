package com.crdpls.api.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "astra_kb_article_views",
    indexes = {
        @Index(name = "idx_astra_view_article", columnList = "article_id"),
        @Index(name = "idx_astra_view_created", columnList = "created_at"),
        @Index(name = "idx_astra_view_user", columnList = "viewer_user_id"),
        @Index(name = "idx_astra_view_session", columnList = "session_id")
    }
)
public class AstraKbArticleViewEvent {

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

    @Column(name = "session_id", length = 120)
    private String sessionId;

    @Column(name = "source", length = 48)
    private String source;

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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}

