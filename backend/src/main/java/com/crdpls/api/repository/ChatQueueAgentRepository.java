package com.crdpls.api.repository;

import com.crdpls.api.models.ChatQueueAgent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatQueueAgentRepository extends JpaRepository<ChatQueueAgent, Long> {
    List<ChatQueueAgent> findByQueueIdAndActiveTrue(Long queueId);
    List<ChatQueueAgent> findByQueueProjectIdAndUserIdAndActiveTrue(Long projectId, Long userId);
    List<ChatQueueAgent> findByQueueProjectIdAndActiveTrue(Long projectId);
    Optional<ChatQueueAgent> findByQueueIdAndUserId(Long queueId, Long userId);
    void deleteByQueueId(Long queueId);
}
