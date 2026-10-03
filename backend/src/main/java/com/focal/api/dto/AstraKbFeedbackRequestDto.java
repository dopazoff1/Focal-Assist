package com.focal.api.dto;

public class AstraKbFeedbackRequestDto {
    private String sentiment;
    private String feedbackText;
    private String viewerName;
    private String viewerEmail;

    public String getSentiment() {
        return sentiment;
    }

    public void setSentiment(String sentiment) {
        this.sentiment = sentiment;
    }

    public String getFeedbackText() {
        return feedbackText;
    }

    public void setFeedbackText(String feedbackText) {
        this.feedbackText = feedbackText;
    }

    public String getViewerName() {
        return viewerName;
    }

    public void setViewerName(String viewerName) {
        this.viewerName = viewerName;
    }

    public String getViewerEmail() {
        return viewerEmail;
    }

    public void setViewerEmail(String viewerEmail) {
        this.viewerEmail = viewerEmail;
    }
}

