package com.crdpls.api.dto;

public class ProcessAssistantSendMessageRequestDto {
    private String text;
    private Long promptProfileId;

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public Long getPromptProfileId() {
        return promptProfileId;
    }

    public void setPromptProfileId(Long promptProfileId) {
        this.promptProfileId = promptProfileId;
    }
}

