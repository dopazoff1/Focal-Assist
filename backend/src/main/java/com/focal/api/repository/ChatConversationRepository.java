package com.focal.api.repository;

import com.focal.api.models.ChatConversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChatConversationRepository extends JpaRepository<ChatConversation, Long> {

    @Query("""
        SELECT c
        FROM ChatConversation c
        WHERE c.assignedUser.id = :userId
        ORDER BY c.lastMessageAt DESC
    """)
    List<ChatConversation> findAssignedToUser(@Param("userId") Long userId);

    @Query("""
        SELECT c
        FROM ChatConversation c
        ORDER BY c.lastMessageAt DESC
    """)
    List<ChatConversation> findAllLatestFirst();

    Optional<ChatConversation> findByExternalThreadIdAndChannelType(String externalThreadId, String channelType);

    @Query("""
        SELECT COUNT(c)
        FROM ChatConversation c
        WHERE c.assignedUser.id = :userId
          AND c.status IN ('open', 'pending')
    """)
    long countActiveAssigned(@Param("userId") Long userId);
}
