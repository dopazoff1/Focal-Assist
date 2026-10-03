package com.focal.api.dto;

import java.util.ArrayList;
import java.util.List;

public class ProcessAssistantPromptMapResponseDto {
    private List<ProcessAssistantPromptProfileDto> profiles = new ArrayList<>();
    private List<ProcessAssistantPromptRoleLinkDto> links = new ArrayList<>();

    public List<ProcessAssistantPromptProfileDto> getProfiles() {
        return profiles;
    }

    public void setProfiles(List<ProcessAssistantPromptProfileDto> profiles) {
        this.profiles = profiles;
    }

    public List<ProcessAssistantPromptRoleLinkDto> getLinks() {
        return links;
    }

    public void setLinks(List<ProcessAssistantPromptRoleLinkDto> links) {
        this.links = links;
    }
}

