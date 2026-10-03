package com.focal.api.dto;

public class ProcessAssistantRespondResponseDto {
    private String content;

    public ProcessAssistantRespondResponseDto() {
    }

    public ProcessAssistantRespondResponseDto(String content) {
        this.content = content;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}

