package com.crdpls.api.dto;

public class QaEvaluationCreateRequestDto {
    private Long conversationId;
    private Long evaluatedUserId;
    private Integer score;
    private String strengths;
    private String improvements;
    private String comment;

    public Long getConversationId() {
        return conversationId;
    }

    public void setConversationId(Long conversationId) {
        this.conversationId = conversationId;
    }

    public Long getEvaluatedUserId() {
        return evaluatedUserId;
    }

    public void setEvaluatedUserId(Long evaluatedUserId) {
        this.evaluatedUserId = evaluatedUserId;
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
}

