package com.focal.api.repository;

import com.focal.api.models.KbValidationStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface KbValidationStepRepository extends JpaRepository<KbValidationStep, Long> {
    List<KbValidationStep> findByRevisionIdOrderByStepOrderAsc(Long revisionId);

    @Query("""
            select s from KbValidationStep s
            join fetch s.revision r
            join fetch r.article a
            join fetch r.createdBy creator
            join fetch r.category category
            join fetch s.reviewer reviewer
            where r.status = com.focal.api.models.KbRevisionStatus.PENDING_REVIEW
              and r.currentStep = s.stepOrder
              and s.reviewer.id = :reviewerId
            order by r.submittedAt asc, r.id asc
            """)
    List<KbValidationStep> findCurrentQueueForReviewer(@Param("reviewerId") Long reviewerId);

    void deleteByRevisionId(Long revisionId);
}
