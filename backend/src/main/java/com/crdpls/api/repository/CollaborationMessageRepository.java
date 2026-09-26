package com.crdpls.api.repository;

import com.crdpls.api.models.CollaborationMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CollaborationMessageRepository extends JpaRepository<CollaborationMessage, Long> {
    List<CollaborationMessage> findByRoomIdOrderByCreatedAtAsc(Long roomId);
    List<CollaborationMessage> findByRoomIdInOrderByCreatedAtAsc(Collection<Long> roomIds);
    List<CollaborationMessage> findByRoomIdAndParentMessageId(Long roomId, Long parentMessageId);
    List<CollaborationMessage> findByContentContainingIgnoreCaseOrderByCreatedAtDesc(String query);
}

