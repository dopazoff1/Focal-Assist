package com.crdpls.api.repository;

import com.crdpls.api.models.CemInternalNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CemInternalNoteRepository extends JpaRepository<CemInternalNote, Long> {
    List<CemInternalNote> findByConversationIdOrderByCreatedAtAsc(Long conversationId);
}

