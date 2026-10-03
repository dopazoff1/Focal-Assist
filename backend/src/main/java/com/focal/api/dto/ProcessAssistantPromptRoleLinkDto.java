package com.focal.api.dto;

public class ProcessAssistantPromptRoleLinkDto {
    private String role;
    private Long promptProfileId;

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Long getPromptProfileId() {
        return promptProfileId;
    }

    public void setPromptProfileId(Long promptProfileId) {
        this.promptProfileId = promptProfileId;
    }
}

