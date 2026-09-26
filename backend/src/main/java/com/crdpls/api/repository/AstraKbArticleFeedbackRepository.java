package com.crdpls.api.repository;

import com.crdpls.api.models.AstraKbArticleFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface AstraKbArticleFeedbackRepository extends JpaRepository<AstraKbArticleFeedback, Long> {
    long countByCreatedAtAfter(LocalDateTime since);
    long countByCreatedAtAfterAndSentiment(LocalDateTime since, String sentiment);
    List<AstraKbArticleFeedback> findByCreatedAtAfter(LocalDateTime since);
    List<AstraKbArticleFeedback> findTop200ByArticle_IdOrderByCreatedAtDesc(Long articleId);
    List<AstraKbArticleFeedback> findTop120ByOrderByCreatedAtDesc();
}

