package com.focal.api.repository;

import com.focal.api.models.CemInternalNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CemInternalNoteRepository extends JpaRepository<CemInternalNote, Long> {
    List<CemInternalNote> findByConversationIdOrderByCreatedAtAsc(Long conversationId);
}

