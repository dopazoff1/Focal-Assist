package com.focal.api.repository;

import com.focal.api.models.KbMapEdge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface KbMapEdgeRepository extends JpaRepository<KbMapEdge, Long> {
    List<KbMapEdge> findByArticleIdOrderByDisplayOrderAscIdAsc(Long articleId);
    @Query("select e from KbMapEdge e where e.article.id in :articleIds order by e.article.id asc, e.displayOrder asc, e.id asc")
    List<KbMapEdge> findByArticleIds(@Param("articleIds") List<Long> articleIds);
    void deleteByArticleId(Long articleId);
}
