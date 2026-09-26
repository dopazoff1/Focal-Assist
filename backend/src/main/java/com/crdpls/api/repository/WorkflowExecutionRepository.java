package com.crdpls.api.repository;

import com.crdpls.api.models.WorkflowExecution;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowExecutionRepository extends JpaRepository<WorkflowExecution, Long> {
}
