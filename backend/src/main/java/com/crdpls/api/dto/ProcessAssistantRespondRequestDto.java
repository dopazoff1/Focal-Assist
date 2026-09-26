package com.crdpls.api.dto;

import java.util.ArrayList;
import java.util.List;

public class ProcessAssistantRespondRequestDto {
    private String conversationId;
    private String model;
    private Double temperature;
    private Integer maxTokens;
    private String systemPrompt;
    private List<ProcessAssistantRespondMessageDto> messages = new ArrayList<>();

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public Integer getMaxTokens() {
        return maxTokens;
    }

    public void setMaxTokens(Integer maxTokens) {
        this.maxTokens = maxTokens;
    }

    public String getSystemPrompt() {
        return systemPrompt;
    }

    public void setSystemPrompt(String systemPrompt) {
        this.systemPrompt = systemPrompt;
    }

    public List<ProcessAssistantRespondMessageDto> getMessages() {
        return messages;
    }

    public void setMessages(List<ProcessAssistantRespondMessageDto> messages) {
        this.messages = messages;
    }
}

