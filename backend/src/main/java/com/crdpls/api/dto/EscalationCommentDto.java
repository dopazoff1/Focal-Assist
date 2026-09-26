package com.crdpls.api.dto;

public class EscalationCommentDto {
    private Long id;
    private Long ticketId;
    private Long authorUserId;
    private String authorName;
    private String authorRole;
    private String source;
    private String body;
    private String createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getTicketId() { return ticketId; }
    public void setTicketId(Long ticketId) { this.ticketId = ticketId; }
    public Long getAuthorUserId() { return authorUserId; }
    public void setAuthorUserId(Long authorUserId) { this.authorUserId = authorUserId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getAuthorRole() { return authorRole; }
    public void setAuthorRole(String authorRole) { this.authorRole = authorRole; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}

