package com.focal.api.models;

import jakarta.persistence.*;

@Entity
@Table(
    name = "collab_message_articles",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_collab_message_article", columnNames = {"message_id", "article_id"})
    },
    indexes = {
        @Index(name = "idx_collab_message_articles_message", columnList = "message_id")
    }
)
public class CollaborationMessageArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false)
    private CollaborationMessage message;

    @Column(name = "article_id", nullable = false)
    private Long articleId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public CollaborationMessage getMessage() {
        return message;
    }

    public void setMessage(CollaborationMessage message) {
        this.message = message;
    }

    public Long getArticleId() {
        return articleId;
    }

    public void setArticleId(Long articleId) {
        this.articleId = articleId;
    }
}

