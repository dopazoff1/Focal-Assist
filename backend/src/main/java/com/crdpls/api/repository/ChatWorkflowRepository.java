package com.crdpls.api.repository;

import com.crdpls.api.models.ChatWorkflow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatWorkflowRepository extends JpaRepository<ChatWorkflow, Long> {
    List<ChatWorkflow> findByProjectIdOrderByVersionDesc(Long projectId);
    Optional<ChatWorkflow> findFirstByProjectIdAndStatusOrderByVersionDesc(Long projectId, String status);
    Optional<ChatWorkflow> findFirstByProjectIdOrderByVersionDesc(Long projectId);
    void deleteByProjectId(Long projectId);
}
