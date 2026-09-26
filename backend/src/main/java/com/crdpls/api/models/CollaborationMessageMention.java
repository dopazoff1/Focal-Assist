package com.crdpls.api.models;

import jakarta.persistence.*;

@Entity
@Table(
    name = "collab_message_mentions",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_collab_message_mention", columnNames = {"message_id", "user_id"})
    },
    indexes = {
        @Index(name = "idx_collab_message_mentions_user", columnList = "user_id")
    }
)
public class CollaborationMessageMention {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false)
    private CollaborationMessage message;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

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

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }
}

