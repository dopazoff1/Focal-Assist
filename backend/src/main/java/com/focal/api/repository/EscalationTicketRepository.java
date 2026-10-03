package com.focal.api.repository;

import com.focal.api.models.EscalationTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EscalationTicketRepository extends JpaRepository<EscalationTicket, Long> {
    List<EscalationTicket> findAllByOrderByUpdatedAtDesc();
    List<EscalationTicket> findByClientIdIgnoreCaseOrderByUpdatedAtDesc(String clientId);

    @Query(value = "select * from escalation_tickets where id = :ticketId for update", nativeQuery = true)
    Optional<EscalationTicket> findByIdForUpdate(@Param("ticketId") Long ticketId);
}
