package com.focal.api.dto;

public class AstraKbPublicTicketCreateRequestDto {
    private Long articleId;
    private String requesterName;
    private String requesterEmail;
    private String requesterCompany;
    private String subject;
    private String description;
    private String priority;

    public Long getArticleId() {
        return articleId;
    }

    public void setArticleId(Long articleId) {
        this.articleId = articleId;
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
}

