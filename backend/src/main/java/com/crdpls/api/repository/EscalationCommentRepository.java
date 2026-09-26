package com.crdpls.api.repository;

import com.crdpls.api.models.EscalationComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EscalationCommentRepository extends JpaRepository<EscalationComment, Long> {
    List<EscalationComment> findByTicket_IdOrderByCreatedAtAsc(Long ticketId);
    List<EscalationComment> findByTicket_IdInOrderByCreatedAtAsc(List<Long> ticketIds);
}
