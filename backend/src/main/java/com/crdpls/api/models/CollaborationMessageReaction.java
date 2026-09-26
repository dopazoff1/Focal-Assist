package com.crdpls.api.models;

import jakarta.persistence.*;

@Entity
@Table(
    name = "collab_message_reactions",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_collab_message_reaction", columnNames = {"message_id", "emoji", "user_id"})
    },
    indexes = {
        @Index(name = "idx_collab_message_reactions_message", columnList = "message_id")
    }
)
public class CollaborationMessageReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false)
    private CollaborationMessage message;

    @Column(nullable = false, length = 64)
    private String emoji;

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

    public String getEmoji() {
        return emoji;
    }

    public void setEmoji(String emoji) {
        this.emoji = emoji;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }
}

