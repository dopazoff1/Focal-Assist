package com.crdpls.api.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "escalation_comments",
    indexes = {
        @Index(name = "idx_escalation_comments_ticket", columnList = "ticket_id"),
        @Index(name = "idx_escalation_comments_created_at", columnList = "created_at")
    }
)
public class EscalationComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    private EscalationTicket ticket;

    @Column(name = "author_user_id", nullable = false)
    private Long authorUserId;

    @Column(name = "author_name", nullable = false, length = 180)
    private String authorName;

    @Column(name = "author_role", nullable = false, length = 80)
    private String authorRole;

    @Column(nullable = false, length = 20)
    private String source;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String body;

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

    public EscalationTicket getTicket() {
        return ticket;
    }

    public void setTicket(EscalationTicket ticket) {
        this.ticket = ticket;
    }

    public Long getAuthorUserId() {
        return authorUserId;
    }

    public void setAuthorUserId(Long authorUserId) {
        this.authorUserId = authorUserId;
    }

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String authorName) {
        this.authorName = authorName;
    }

    public String getAuthorRole() {
        return authorRole;
    }

    public void setAuthorRole(String authorRole) {
        this.authorRole = authorRole;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}

