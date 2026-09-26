package com.crdpls.api.repository;

import com.crdpls.api.models.ChatQueue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatQueueRepository extends JpaRepository<ChatQueue, Long> {
    List<ChatQueue> findByProjectIdOrderByPriorityAscNameAsc(Long projectId);
    List<ChatQueue> findByProjectIdAndArchivedFalseOrderByPriorityAscNameAsc(Long projectId);
    void deleteByProjectId(Long projectId);
}
