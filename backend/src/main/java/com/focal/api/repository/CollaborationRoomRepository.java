package com.focal.api.repository;

import com.focal.api.models.CollaborationRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CollaborationRoomRepository extends JpaRepository<CollaborationRoom, Long> {
    List<CollaborationRoom> findByIdInAndArchivedFalse(Collection<Long> ids);
    List<CollaborationRoom> findByKindAndArchivedFalse(String kind);
}

