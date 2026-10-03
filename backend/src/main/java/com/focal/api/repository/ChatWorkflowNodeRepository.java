package com.focal.api.repository;

import com.focal.api.models.ChatWorkflowNode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatWorkflowNodeRepository extends JpaRepository<ChatWorkflowNode, Long> {
    List<ChatWorkflowNode> findByWorkflowIdOrderByIdAsc(Long workflowId);
    Optional<ChatWorkflowNode> findByWorkflowIdAndClientNodeId(Long workflowId, String clientNodeId);
    void deleteByWorkflowId(Long workflowId);
}
