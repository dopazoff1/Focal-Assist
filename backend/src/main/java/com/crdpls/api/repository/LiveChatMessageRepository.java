package com.crdpls.api.repository;

import com.crdpls.api.models.LiveChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LiveChatMessageRepository extends JpaRepository<LiveChatMessage, Long> {
    List<LiveChatMessage> findBySessionIdOrderByCreatedAtAscIdAsc(Long sessionId);
    void deleteBySessionProjectId(Long projectId);
}
