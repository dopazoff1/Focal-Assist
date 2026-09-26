package com.crdpls.api.dto;

public class QaEvaluationDto {
    private Long id;
    private Long conversationId;
    private String conversationSubject;
    private Long evaluatedUserId;
    private String evaluatedUserName;
    private Long evaluatorUserId;
    private String evaluatorUserName;
    private Integer score;
    private String strengths;
    private String improvements;
    private String comment;
    private String createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getConversationId() {
        return conversationId;
    }

    public void setConversationId(Long conversationId) {
        this.conversationId = conversationId;
    }

    public String getConversationSubject() {
        return conversationSubject;
    }

    public void setConversationSubject(String conversationSubject) {
        this.conversationSubject = conversationSubject;
    }

    public Long getEvaluatedUserId() {
        return evaluatedUserId;
    }

    public void setEvaluatedUserId(Long evaluatedUserId) {
        this.evaluatedUserId = evaluatedUserId;
    }

    public String getEvaluatedUserName() {
        return evaluatedUserName;
    }

    public void setEvaluatedUserName(String evaluatedUserName) {
        this.evaluatedUserName = evaluatedUserName;
    }

    public Long getEvaluatorUserId() {
        return evaluatorUserId;
    }

    public void setEvaluatorUserId(Long evaluatorUserId) {
        this.evaluatorUserId = evaluatorUserId;
    }

    public String getEvaluatorUserName() {
        return evaluatorUserName;
    }

    public void setEvaluatorUserName(String evaluatorUserName) {
        this.evaluatorUserName = evaluatorUserName;
    }

    public Integer getScore() {
        return score;
    }

    public void setScore(Integer score) {
        this.score = score;
    }

    public String getStrengths() {
        return strengths;
    }

    public void setStrengths(String strengths) {
        this.strengths = strengths;
    }

    public String getImprovements() {
        return improvements;
    }

    public void setImprovements(String improvements) {
        this.improvements = improvements;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}

