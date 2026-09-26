package com.crdpls.api.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "astra_kb_public_tickets",
    indexes = {
        @Index(name = "idx_astra_pub_ticket_status", columnList = "status"),
        @Index(name = "idx_astra_pub_ticket_created", columnList = "created_at"),
        @Index(name = "idx_astra_pub_ticket_updated", columnList = "updated_at"),
        @Index(name = "idx_astra_pub_ticket_article", columnList = "article_id"),
        @Index(name = "idx_astra_pub_ticket_requester", columnList = "requester_email")
    }
)
public class AstraKbPublicTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_key", nullable = false, unique = true, length = 32)
    private String ticketKey;

    @Column(name = "article_id")
    private Long articleId;

    @Column(name = "article_title_snapshot", length = 255)
    private String articleTitleSnapshot;

    @Column(name = "requester_name", nullable = false, length = 180)
    private String requesterName;

    @Column(name = "requester_email", nullable = false, length = 255)
    private String requesterEmail;

    @Column(name = "requester_company", length = 180)
    private String requesterCompany;

    @Column(name = "subject", nullable = false, length = 255)
    private String subject;

    @Lob
    @Column(name = "description", columnDefinition = "LONGTEXT")
    private String description;

    @Column(name = "priority", nullable = false, length = 16)
    private String priority;

    @Column(name = "status", nullable = false, length = 24)
    private String status;

    @Column(name = "assignee_user_id")
    private Long assigneeUserId;

    @Column(name = "assignee_name", length = 180)
    private String assigneeName;

    @Lob
    @Column(name = "internal_note", columnDefinition = "LONGTEXT")
    private String internalNote;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    public void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTicketKey() {
        return ticketKey;
    }

    public void setTicketKey(String ticketKey) {
        this.ticketKey = ticketKey;
    }

    public Long getArticleId() {
        return articleId;
    }

    public void setArticleId(Long articleId) {
        this.articleId = articleId;
    }

    public String getArticleTitleSnapshot() {
        return articleTitleSnapshot;
    }

    public void setArticleTitleSnapshot(String articleTitleSnapshot) {
        this.articleTitleSnapshot = articleTitleSnapshot;
    }

    public String getRequesterName() {
        return requesterName;
    }

    public void setRequesterName(String requesterName) {
        this.requesterName = requesterName;
    }

    public String getRequesterEmail() {
        return requesterEmail;
    }

    public void setRequesterEmail(String requesterEmail) {
        this.requesterEmail = requesterEmail;
    }

    public String getRequesterCompany() {
        return requesterCompany;
    }

    public void setRequesterCompany(String requesterCompany) {
        this.requesterCompany = requesterCompany;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getAssigneeUserId() {
        return assigneeUserId;
    }

    public void setAssigneeUserId(Long assigneeUserId) {
        this.assigneeUserId = assigneeUserId;
    }

    public String getAssigneeName() {
        return assigneeName;
    }

    public void setAssigneeName(String assigneeName) {
        this.assigneeName = assigneeName;
    }

    public String getInternalNote() {
        return internalNote;
    }

    public void setInternalNote(String internalNote) {
        this.internalNote = internalNote;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}

