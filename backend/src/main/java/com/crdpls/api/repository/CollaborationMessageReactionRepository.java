package com.crdpls.api.repository;

import com.crdpls.api.models.CollaborationMessageReaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CollaborationMessageReactionRepository extends JpaRepository<CollaborationMessageReaction, Long> {
    List<CollaborationMessageReaction> findByMessageId(Long messageId);
    List<CollaborationMessageReaction> findByMessageIdIn(Collection<Long> messageIds);
    Optional<CollaborationMessageReaction> findByMessageIdAndEmojiAndUserId(Long messageId, String emoji, Long userId);
    void deleteByMessageIdIn(Collection<Long> messageIds);
}

