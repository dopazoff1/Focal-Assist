package com.crdpls.api.repository;

import com.crdpls.api.models.CemConversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CemConversationRepository extends JpaRepository<CemConversation, Long> {

    @Query("""
            SELECT c
            FROM CemConversation c
            WHERE c.assignedUser.id = :userId
              AND c.status IN ('open', 'pending')
            ORDER BY COALESCE(c.lastMessageAt, c.createdAt) ASC
            """)
    List<CemConversation> findMyPlaylistCases(@Param("userId") Long userId);

    @Query("""
            SELECT c
            FROM CemConversation c
            WHERE c.assignedUser.id = :userId
              AND c.status = 'open'
            ORDER BY c.queueName ASC, COALESCE(c.lastMessageAt, c.createdAt) ASC
            """)
    List<CemConversation> findOpenCasesAssigned(@Param("userId") Long userId);

    @Modifying
    @Query(value = """
            UPDATE cem_conversations
            SET assigned_user_id = :userId
            WHERE id = (
                SELECT id
                FROM (
                    SELECT id
                    FROM cem_conversations
                    WHERE assigned_user_id IS NULL
                      AND status IN ('open', 'pending')
                    ORDER BY COALESCE(last_message_at, created_at) ASC
                    LIMIT 1
                ) oldest
            )
            """, nativeQuery = true)
    int assignOldestUnassignedToUser(@Param("userId") Long userId);

    @Modifying
    @Query(value = "DELETE FROM cem_conversation_tags", nativeQuery = true)
    int clearAllTagLinks();

    Optional<CemConversation> findByIdAndAssignedUserId(Long id, Long userId);
    Optional<CemConversation> findByGmailThreadId(String gmailThreadId);

    List<CemConversation> findAllByOrderByUpdatedAtDesc();
    List<CemConversation> findAllByAssignedUserIdOrderByUpdatedAtDesc(Long userId);
}


