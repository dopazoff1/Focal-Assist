package com.focal.api.models;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "chat_queue_agents",
    uniqueConstraints = @UniqueConstraint(name = "uk_chat_queue_agent", columnNames = {"queue_id", "user_id"}),
    indexes = {
        @Index(name = "idx_chat_queue_agents_queue", columnList = "queue_id"),
        @Index(name = "idx_chat_queue_agents_user", columnList = "user_id")
    }
)
public class ChatQueueAgent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "queue_id", nullable = false)
    private ChatQueue queue;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ChatQueue getQueue() { return queue; }
    public void setQueue(ChatQueue queue) { this.queue = queue; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
