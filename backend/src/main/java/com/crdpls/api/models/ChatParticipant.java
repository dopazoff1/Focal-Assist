package com.crdpls.api.models;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_participants", indexes = @Index(name = "idx_chat_participants_session", columnList = "session_id"))
public class ChatParticipant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private LiveChatSession session;

    @Column(nullable = false, length = 24)
    private String type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(length = 180)
    private String displayName;

    @Column(length = 220)
    private String email;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;

    @PrePersist
    public void onCreate() { this.joinedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LiveChatSession getSession() { return session; }
    public void setSession(LiveChatSession session) { this.session = session; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
}
