package com.focal.api.repository;

import com.focal.api.models.AstraKbArticleViewEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface AstraKbArticleViewEventRepository extends JpaRepository<AstraKbArticleViewEvent, Long> {
    long countByCreatedAtAfter(LocalDateTime since);
    List<AstraKbArticleViewEvent> findByCreatedAtAfter(LocalDateTime since);
    List<AstraKbArticleViewEvent> findTop400ByArticle_IdOrderByCreatedAtDesc(Long articleId);
}

