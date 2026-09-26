package com.crdpls.api.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "collab_messages",
    indexes = {
        @Index(name = "idx_collab_messages_room", columnList = "room_id"),
        @Index(name = "idx_collab_messages_parent", columnList = "parent_message_id"),
        @Index(name = "idx_collab_messages_created", columnList = "created_at")
    }
)
public class CollaborationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private CollaborationRoom room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_user_id", nullable = false)
    private User senderUser;

    @Column(nullable = false, length = 16)
    private String kind; // USER | SYSTEM

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_message_id")
    private CollaborationMessage parentMessage;

    @Column(nullable = false)
    private Boolean pinned = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "edited_at")
    private LocalDateTime editedAt;

    @PrePersist
    public void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

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

    public User getSenderUser() {
        return senderUser;
    }

    public void setSenderUser(User senderUser) {
        this.senderUser = senderUser;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public CollaborationMessage getParentMessage() {
        return parentMessage;
    }

    public void setParentMessage(CollaborationMessage parentMessage) {
        this.parentMessage = parentMessage;
    }

    public Boolean getPinned() {
        return pinned;
    }

    public void setPinned(Boolean pinned) {
        this.pinned = pinned;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getEditedAt() {
        return editedAt;
    }

    public void setEditedAt(LocalDateTime editedAt) {
        this.editedAt = editedAt;
    }
}

