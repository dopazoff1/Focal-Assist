package com.crdpls.api.repository;

import com.crdpls.api.models.LiveChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LiveChatSessionRepository extends JpaRepository<LiveChatSession, Long> {
    Optional<LiveChatSession> findByPublicToken(String publicToken);
    List<LiveChatSession> findByProjectIdOrderByUpdatedAtDesc(Long projectId);
    List<LiveChatSession> findByAssignedAgentIdOrderByUpdatedAtDesc(Long assignedAgentId);
    long countByAssignedAgentIdAndStatusIn(Long assignedAgentId, Collection<String> statuses);
    long countByQueueIdAndStatusIn(Long queueId, Collection<String> statuses);

    @Query("""
        select s from LiveChatSession s
        where (:projectId is null or s.project.id = :projectId)
          and (:queueId is null or s.queue.id = :queueId)
          and (:status is null or s.status = :status)
          and (:agentId is null or s.assignedAgent.id = :agentId)
        order by s.updatedAt desc
    """)
    List<LiveChatSession> search(
        @Param("projectId") Long projectId,
        @Param("queueId") Long queueId,
        @Param("status") String status,
        @Param("agentId") Long agentId
    );

    @Query(value = """
        SELECT * FROM live_chat_sessions
        WHERE assigned_agent_id IS NULL
          AND status IN ('WAITING_FOR_AGENT','WAITING_FOR_QUEUE')
          AND (:projectId IS NULL OR project_id = :projectId)
        ORDER BY updated_at ASC, id ASC
        LIMIT 1 FOR UPDATE
    """, nativeQuery = true)
    Optional<LiveChatSession> claimOldestUnassigned(@Param("projectId") Long projectId);

    @Query(value = """
        SELECT * FROM live_chat_sessions
        WHERE assigned_agent_id IS NULL
          AND status IN ('WAITING_FOR_AGENT','WAITING_FOR_QUEUE')
          AND queue_id IN (:queueIds)
        ORDER BY updated_at ASC, id ASC
        LIMIT 1 FOR UPDATE
    """, nativeQuery = true)
    Optional<LiveChatSession> claimOldestUnassignedForQueues(@Param("queueIds") Collection<Long> queueIds);
}
