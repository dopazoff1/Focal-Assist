package com.focal.api.repository;

import com.focal.api.models.CollaborationMessageArticle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CollaborationMessageArticleRepository extends JpaRepository<CollaborationMessageArticle, Long> {
    List<CollaborationMessageArticle> findByMessageId(Long messageId);
    List<CollaborationMessageArticle> findByMessageIdIn(Collection<Long> messageIds);
    void deleteByMessageIdIn(Collection<Long> messageIds);
}

