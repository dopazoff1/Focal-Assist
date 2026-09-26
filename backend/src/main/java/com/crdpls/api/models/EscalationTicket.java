package com.crdpls.api.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "escalation_tickets",
    indexes = {
        @Index(name = "idx_escalation_tickets_status", columnList = "status"),
        @Index(name = "idx_escalation_tickets_level", columnList = "level"),
        @Index(name = "idx_escalation_tickets_created_by_user", columnList = "created_by_user_id"),
        @Index(name = "idx_escalation_tickets_l2_assignee_user", columnList = "l2_assignee_user_id"),
        @Index(name = "idx_escalation_tickets_client_id", columnList = "client_id"),
        @Index(name = "idx_escalation_tickets_updated_at", columnList = "updated_at")
    }
)
public class EscalationTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_key", nullable = false, unique = true, length = 32)
    private String key;

    @Column(nullable = false, length = 280)
    private String title;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String description;

    @Column(name = "customer_email", length = 255)
    private String customerEmail;

    @Column(name = "client_id", length = 120)
    private String clientId;

    @Lob
    @Column(name = "issue_types_json", columnDefinition = "LONGTEXT")
    private String issueTypesJson;

    @Column(nullable = false, length = 20)
    private String priority;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(nullable = false, length = 10)
    private String level;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "created_by_name", nullable = false, length = 180)
    private String createdByName;

    @Column(name = "created_by_role", nullable = false, length = 80)
    private String createdByRole;

    @Column(name = "l2_assignee_user_id")
    private Long l2AssigneeUserId;

    @Column(name = "l2_assignee_name", length = 180)
    private String l2AssigneeName;

    @Lob
    @Column(name = "escalation_reason", columnDefinition = "LONGTEXT")
    private String escalationReason;

    @Column(name = "escalated_at")
    private LocalDateTime escalatedAt;

    @Column(name = "jira_issue_key", length = 80)
    private String jiraIssueKey;

    @Column(name = "jira_issue_url", length = 500)
    private String jiraIssueUrl;

    @Column(name = "jira_status", length = 120)
    private String jiraStatus;

    @Column(name = "jira_synced_at")
    private LocalDateTime jiraSyncedAt;

    @Column(name = "duplicate_of_ticket_id")
    private Long duplicateOfTicketId;

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

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCustomerEmail() {
        return customerEmail;
    }

    public void setCustomerEmail(String customerEmail) {
        this.customerEmail = customerEmail;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getIssueTypesJson() {
        return issueTypesJson;
    }

    public void setIssueTypesJson(String issueTypesJson) {
        this.issueTypesJson = issueTypesJson;
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

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public Long getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(Long createdByUserId) {
        this.createdByUserId = createdByUserId;
    }

    public String getCreatedByName() {
        return createdByName;
    }

    public void setCreatedByName(String createdByName) {
        this.createdByName = createdByName;
    }

    public String getCreatedByRole() {
        return createdByRole;
    }

    public void setCreatedByRole(String createdByRole) {
        this.createdByRole = createdByRole;
    }

    public Long getL2AssigneeUserId() {
        return l2AssigneeUserId;
    }

    public void setL2AssigneeUserId(Long l2AssigneeUserId) {
        this.l2AssigneeUserId = l2AssigneeUserId;
    }

    public String getL2AssigneeName() {
        return l2AssigneeName;
    }

    public void setL2AssigneeName(String l2AssigneeName) {
        this.l2AssigneeName = l2AssigneeName;
    }

    public String getEscalationReason() {
        return escalationReason;
    }

    public void setEscalationReason(String escalationReason) {
        this.escalationReason = escalationReason;
    }

    public LocalDateTime getEscalatedAt() {
        return escalatedAt;
    }

    public void setEscalatedAt(LocalDateTime escalatedAt) {
        this.escalatedAt = escalatedAt;
    }

    public String getJiraIssueKey() {
        return jiraIssueKey;
    }

    public void setJiraIssueKey(String jiraIssueKey) {
        this.jiraIssueKey = jiraIssueKey;
    }

    public String getJiraIssueUrl() {
        return jiraIssueUrl;
    }

    public void setJiraIssueUrl(String jiraIssueUrl) {
        this.jiraIssueUrl = jiraIssueUrl;
    }

    public String getJiraStatus() {
        return jiraStatus;
    }

    public void setJiraStatus(String jiraStatus) {
        this.jiraStatus = jiraStatus;
    }

    public LocalDateTime getJiraSyncedAt() {
        return jiraSyncedAt;
    }

    public void setJiraSyncedAt(LocalDateTime jiraSyncedAt) {
        this.jiraSyncedAt = jiraSyncedAt;
    }

    public Long getDuplicateOfTicketId() {
        return duplicateOfTicketId;
    }

    public void setDuplicateOfTicketId(Long duplicateOfTicketId) {
        this.duplicateOfTicketId = duplicateOfTicketId;
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

