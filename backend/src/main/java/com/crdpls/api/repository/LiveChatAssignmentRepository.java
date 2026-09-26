package com.crdpls.api.repository;

import com.crdpls.api.models.LiveChatAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LiveChatAssignmentRepository extends JpaRepository<LiveChatAssignment, Long> {
    List<LiveChatAssignment> findBySessionIdAndActiveTrue(Long sessionId);
}
