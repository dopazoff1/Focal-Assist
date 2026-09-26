package com.crdpls.api.models;

import jakarta.persistence.*;

@Entity
@Table(
    name = "collab_room_articles",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_collab_room_article", columnNames = {"room_id", "article_id"})
    },
    indexes = {
        @Index(name = "idx_collab_room_articles_room", columnList = "room_id")
    }
)
public class CollaborationRoomArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private CollaborationRoom room;

    @Column(name = "article_id", nullable = false)
    private Long articleId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public CollaborationRoom getRoom() {
        return room;
    }

    public void setRoom(CollaborationRoom room) {
        this.room = room;
    }

    public Long getArticleId() {
        return articleId;
    }

    public void setArticleId(Long articleId) {
        this.articleId = articleId;
    }
}

