package com.focal.api.repository;

import com.focal.api.models.CollaborationMessageMention;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CollaborationMessageMentionRepository extends JpaRepository<CollaborationMessageMention, Long> {
    List<CollaborationMessageMention> findByMessageId(Long messageId);
    List<CollaborationMessageMention> findByMessageIdIn(Collection<Long> messageIds);
    List<CollaborationMessageMention> findByUserIdOrderByMessage_CreatedAtDesc(Long userId);
    void deleteByMessageIdIn(Collection<Long> messageIds);
}

