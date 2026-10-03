package com.focal.api.repository;

import com.focal.api.models.KbValidationComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KbValidationCommentRepository extends JpaRepository<KbValidationComment, Long> {
    List<KbValidationComment> findByRevisionIdOrderByCreatedAtAscIdAsc(Long revisionId);
}
