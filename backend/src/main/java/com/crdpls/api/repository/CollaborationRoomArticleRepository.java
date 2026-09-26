package com.crdpls.api.repository;

import com.crdpls.api.models.CollaborationRoomArticle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CollaborationRoomArticleRepository extends JpaRepository<CollaborationRoomArticle, Long> {
    List<CollaborationRoomArticle> findByRoomId(Long roomId);
    List<CollaborationRoomArticle> findByRoomIdIn(Collection<Long> roomIds);
    void deleteByRoomId(Long roomId);
}

