package com.crdpls.api.repository;

import com.crdpls.api.models.AstraKbPublicTicket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AstraKbPublicTicketRepository extends JpaRepository<AstraKbPublicTicket, Long> {
    List<AstraKbPublicTicket> findAllByOrderByUpdatedAtDesc();
    Optional<AstraKbPublicTicket> findByTicketKey(String ticketKey);
    long countByStatusIgnoreCase(String status);
    long countByCreatedAtAfter(LocalDateTime since);
}

