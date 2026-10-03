package com.focal.api.models;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "live_chat_messages",
    indexes = {
        @Index(name = "idx_live_chat_messages_session", columnList = "session_id,created_at"),
        @Index(name = "idx_live_chat_messages_sender", columnList = "sender_type")
    }
)
public class LiveChatMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private LiveChatSession session;

    @Column(name = "sender_type", nullable = false, length = 24)
    private String senderType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_user_id")
    private User senderUser;

    @Column(name = "sender_name", length = 180)
    private String senderName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "metadata_json", columnDefinition = "TEXT")
    private String metadataJson;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LiveChatSession getSession() { return session; }
    public void setSession(LiveChatSession session) { this.session = session; }
    public String getSenderType() { return senderType; }
    public void setSenderType(String senderType) { this.senderType = senderType; }
    public User getSenderUser() { return senderUser; }
    public void setSenderUser(User senderUser) { this.senderUser = senderUser; }
    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getMetadataJson() { return metadataJson; }
    public void setMetadataJson(String metadataJson) { this.metadataJson = metadataJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
