package com.crdpls.api.repository;

import com.crdpls.api.models.ChatWorkflowConnection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatWorkflowConnectionRepository extends JpaRepository<ChatWorkflowConnection, Long> {
    List<ChatWorkflowConnection> findByWorkflowIdOrderByIdAsc(Long workflowId);
    List<ChatWorkflowConnection> findByWorkflowIdAndSourceNodeIdOrderByIdAsc(Long workflowId, String sourceNodeId);
    void deleteByWorkflowId(Long workflowId);
}
