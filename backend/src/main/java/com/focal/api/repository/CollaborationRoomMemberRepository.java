package com.focal.api.repository;

import com.focal.api.models.CollaborationRoomMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CollaborationRoomMemberRepository extends JpaRepository<CollaborationRoomMember, Long> {
    List<CollaborationRoomMember> findByRoomId(Long roomId);
    List<CollaborationRoomMember> findByRoomIdIn(Collection<Long> roomIds);
    Optional<CollaborationRoomMember> findByRoomIdAndUserId(Long roomId, Long userId);
    boolean existsByRoomIdAndUserId(Long roomId, Long userId);
    void deleteByRoomIdAndUserId(Long roomId, Long userId);

    @Query("select m.room.id from CollaborationRoomMember m where m.user.id = :userId")
    List<Long> findRoomIdsByUserId(Long userId);
}
