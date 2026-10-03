package com.focal.api.dto;

public class ChatConversationDto {
    private Long id;
    private String channel;
    private String customerName;
    private String customerHandle;
    private String status;
    private Integer unread;
    private String lastMessageAt;
    private Long assignedUserId;
    private String assignedTo;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerHandle() { return customerHandle; }
    public void setCustomerHandle(String customerHandle) { this.customerHandle = customerHandle; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getUnread() { return unread; }
    public void setUnread(Integer unread) { this.unread = unread; }

    public String getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(String lastMessageAt) { this.lastMessageAt = lastMessageAt; }

    public Long getAssignedUserId() { return assignedUserId; }
    public void setAssignedUserId(Long assignedUserId) { this.assignedUserId = assignedUserId; }

    public String getAssignedTo() { return assignedTo; }
    public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }
}
