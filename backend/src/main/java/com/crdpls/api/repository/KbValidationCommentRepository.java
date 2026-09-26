package com.crdpls.api.repository;

import com.crdpls.api.models.KbValidationComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KbValidationCommentRepository extends JpaRepository<KbValidationComment, Long> {
    List<KbValidationComment> findByRevisionIdOrderByCreatedAtAscIdAsc(Long revisionId);
}
