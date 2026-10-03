package com.focal.api.repository;

import com.focal.api.models.ProcessAssistantMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessAssistantMessageRepository extends JpaRepository<ProcessAssistantMessage, Long> {
    List<ProcessAssistantMessage> findByConversationIdOrderByCreatedAtAsc(Long conversationId);
    List<ProcessAssistantMessage> findTop40ByConversationIdOrderByCreatedAtDesc(Long conversationId);
}

