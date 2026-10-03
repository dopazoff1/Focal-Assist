package com.focal.api.models;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "live_chat_assignments",
    indexes = {
        @Index(name = "idx_live_chat_assignments_session", columnList = "session_id"),
        @Index(name = "idx_live_chat_assignments_agent", columnList = "agent_user_id,active")
    }
)
public class LiveChatAssignment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private LiveChatSession session;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agent_user_id", nullable = false)
    private User agent;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "assigned_at", nullable = false)
    private LocalDateTime assignedAt;

    @Column(name = "released_at")
    private LocalDateTime releasedAt;

    @PrePersist
    public void onCreate() {
        this.assignedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LiveChatSession getSession() { return session; }
    public void setSession(LiveChatSession session) { this.session = session; }
    public User getAgent() { return agent; }
    public void setAgent(User agent) { this.agent = agent; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public LocalDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }
    public LocalDateTime getReleasedAt() { return releasedAt; }
    public void setReleasedAt(LocalDateTime releasedAt) { this.releasedAt = releasedAt; }
}
