package com.crdpls.api.models;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "live_chat_sessions",
    indexes = {
        @Index(name = "idx_live_chat_project_status", columnList = "project_id,status"),
        @Index(name = "idx_live_chat_queue_status", columnList = "queue_id,status"),
        @Index(name = "idx_live_chat_agent_status", columnList = "assigned_agent_id,status"),
        @Index(name = "idx_live_chat_public_token", columnList = "public_token", unique = true)
    }
)
public class LiveChatSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private ChatProject project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "queue_id")
    private ChatQueue queue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_agent_id")
    private User assignedAgent;

    @Column(name = "public_token", nullable = false, unique = true, length = 80)
    private String publicToken;

    @Column(name = "customer_name", length = 180)
    private String customerName;

    @Column(name = "customer_email", length = 220)
    private String customerEmail;

    @Column(nullable = false, length = 40)
    private String status = "BOT_ACTIVE";

    @Column(name = "current_node_id", length = 80)
    private String currentNodeId;

    @Column(name = "variables_json", columnDefinition = "TEXT")
    private String variablesJson;

    @Column(name = "last_message_preview", length = 260)
    private String lastMessagePreview;

    @Column(name = "unread_for_agent", nullable = false)
    private Integer unreadForAgent = 0;

    @Column(name = "unread_for_customer", nullable = false)
    private Integer unreadForCustomer = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "escalated_at")
    private LocalDateTime escalatedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @PrePersist
    public void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
    public ChatProject getProject() { return project; }
    public void setProject(ChatProject project) { this.project = project; }
    public ChatQueue getQueue() { return queue; }
    public void setQueue(ChatQueue queue) { this.queue = queue; }
    public User getAssignedAgent() { return assignedAgent; }
    public void setAssignedAgent(User assignedAgent) { this.assignedAgent = assignedAgent; }
    public String getPublicToken() { return publicToken; }
    public void setPublicToken(String publicToken) { this.publicToken = publicToken; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getCustomerEmail() { return customerEmail; }
    public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCurrentNodeId() { return currentNodeId; }
    public void setCurrentNodeId(String currentNodeId) { this.currentNodeId = currentNodeId; }
    public String getVariablesJson() { return variablesJson; }
    public void setVariablesJson(String variablesJson) { this.variablesJson = variablesJson; }
    public String getLastMessagePreview() { return lastMessagePreview; }
    public void setLastMessagePreview(String lastMessagePreview) { this.lastMessagePreview = lastMessagePreview; }
    public Integer getUnreadForAgent() { return unreadForAgent; }
    public void setUnreadForAgent(Integer unreadForAgent) { this.unreadForAgent = unreadForAgent; }
    public Integer getUnreadForCustomer() { return unreadForCustomer; }
    public void setUnreadForCustomer(Integer unreadForCustomer) { this.unreadForCustomer = unreadForCustomer; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getEscalatedAt() { return escalatedAt; }
    public void setEscalatedAt(LocalDateTime escalatedAt) { this.escalatedAt = escalatedAt; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }
}
