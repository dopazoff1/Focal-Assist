package com.crdpls.api.dto;

import java.util.ArrayList;
import java.util.List;

public class EscalationTicketDto {
    private Long id;
    private String key;
    private String title;
    private String description;
    private String customerEmail;
    private String clientId;
    private List<String> issueTypes = new ArrayList<>();
    private String priority;
    private String status;
    private String level;
    private Long createdByUserId;
    private String createdByName;
    private String createdByRole;
    private Long l2AssigneeUserId;
    private String l2AssigneeName;
    private String escalationReason;
    private String escalatedAt;
    private String jiraIssueKey;
    private String jiraIssueUrl;
    private String jiraStatus;
    private String jiraSyncedAt;
    private Long duplicateOfTicketId;
    private String createdAt;
    private String updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCustomerEmail() { return customerEmail; }
    public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public List<String> getIssueTypes() { return issueTypes; }
    public void setIssueTypes(List<String> issueTypes) { this.issueTypes = issueTypes; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }
    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }
    public String getCreatedByRole() { return createdByRole; }
    public void setCreatedByRole(String createdByRole) { this.createdByRole = createdByRole; }
    public Long getL2AssigneeUserId() { return l2AssigneeUserId; }
    public void setL2AssigneeUserId(Long l2AssigneeUserId) { this.l2AssigneeUserId = l2AssigneeUserId; }
    public String getL2AssigneeName() { return l2AssigneeName; }
    public void setL2AssigneeName(String l2AssigneeName) { this.l2AssigneeName = l2AssigneeName; }
    public String getEscalationReason() { return escalationReason; }
    public void setEscalationReason(String escalationReason) { this.escalationReason = escalationReason; }
    public String getEscalatedAt() { return escalatedAt; }
    public void setEscalatedAt(String escalatedAt) { this.escalatedAt = escalatedAt; }
    public String getJiraIssueKey() { return jiraIssueKey; }
    public void setJiraIssueKey(String jiraIssueKey) { this.jiraIssueKey = jiraIssueKey; }
    public String getJiraIssueUrl() { return jiraIssueUrl; }
    public void setJiraIssueUrl(String jiraIssueUrl) { this.jiraIssueUrl = jiraIssueUrl; }
    public String getJiraStatus() { return jiraStatus; }
    public void setJiraStatus(String jiraStatus) { this.jiraStatus = jiraStatus; }
    public String getJiraSyncedAt() { return jiraSyncedAt; }
    public void setJiraSyncedAt(String jiraSyncedAt) { this.jiraSyncedAt = jiraSyncedAt; }
    public Long getDuplicateOfTicketId() { return duplicateOfTicketId; }
    public void setDuplicateOfTicketId(Long duplicateOfTicketId) { this.duplicateOfTicketId = duplicateOfTicketId; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}

