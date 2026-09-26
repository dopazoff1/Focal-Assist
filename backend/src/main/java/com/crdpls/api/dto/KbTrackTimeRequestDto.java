package com.crdpls.api.dto;

public class KbTrackTimeRequestDto {
    private Long articleId;
    private Integer secondsSpent;
    private String sessionId;
    private String source;

    public Long getArticleId() {
        return articleId;
    }

    public void setArticleId(Long articleId) {
        this.articleId = articleId;
    }

    public Integer getSecondsSpent() {
        return secondsSpent;
    }

    public void setSecondsSpent(Integer secondsSpent) {
        this.secondsSpent = secondsSpent;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }
}
