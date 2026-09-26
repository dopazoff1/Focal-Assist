package com.crdpls.api.repository;

import com.crdpls.api.models.ProcessAssistantConversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProcessAssistantConversationRepository extends JpaRepository<ProcessAssistantConversation, Long> {
    List<ProcessAssistantConversation> findByUserIdOrderByUpdatedAtDesc(Long userId);
    Optional<ProcessAssistantConversation> findByIdAndUserId(Long id, Long userId);
}

