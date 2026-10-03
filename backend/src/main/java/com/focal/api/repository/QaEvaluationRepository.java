package com.focal.api.repository;

import com.focal.api.models.QaEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QaEvaluationRepository extends JpaRepository<QaEvaluation, Long> {
    List<QaEvaluation> findAllByOrderByCreatedAtDesc();
    List<QaEvaluation> findByEvaluatedUserIdOrderByCreatedAtDesc(Long userId);
    List<QaEvaluation> findByConversationIdOrderByCreatedAtDesc(Long conversationId);
}

