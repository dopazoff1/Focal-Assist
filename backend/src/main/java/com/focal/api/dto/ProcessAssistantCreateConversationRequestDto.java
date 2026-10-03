package com.focal.api.dto;

public class ProcessAssistantCreateConversationRequestDto {
    private String title;
    private Long promptProfileId;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Long getPromptProfileId() {
        return promptProfileId;
    }

    public void setPromptProfileId(Long promptProfileId) {
        this.promptProfileId = promptProfileId;
    }
}

