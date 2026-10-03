package com.focal.api.repository;

import com.focal.api.models.EscalationComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EscalationCommentRepository extends JpaRepository<EscalationComment, Long> {
    List<EscalationComment> findByTicket_IdOrderByCreatedAtAsc(Long ticketId);
    List<EscalationComment> findByTicket_IdInOrderByCreatedAtAsc(List<Long> ticketIds);
}
