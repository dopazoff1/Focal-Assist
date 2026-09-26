package com.crdpls.api.repository;

import com.crdpls.api.models.CollaborationRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CollaborationRoomRepository extends JpaRepository<CollaborationRoom, Long> {
    List<CollaborationRoom> findByIdInAndArchivedFalse(Collection<Long> ids);
    List<CollaborationRoom> findByKindAndArchivedFalse(String kind);
}

