package com.focal.api.dto;

import java.util.ArrayList;
import java.util.List;

public class ProcessAssistantSendMessageResponseDto {
    private ProcessAssistantConversationDto conversation;
    private List<ProcessAssistantMessageDto> messages = new ArrayList<>();

    public ProcessAssistantConversationDto getConversation() {
        return conversation;
    }

    public void setConversation(ProcessAssistantConversationDto conversation) {
        this.conversation = conversation;
    }

    public List<ProcessAssistantMessageDto> getMessages() {
        return messages;
    }

    public void setMessages(List<ProcessAssistantMessageDto> messages) {
        this.messages = messages;
    }
}

