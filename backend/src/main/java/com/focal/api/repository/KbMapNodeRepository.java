package com.focal.api.repository;

import com.focal.api.models.KbMapNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface KbMapNodeRepository extends JpaRepository<KbMapNode, Long> {
    List<KbMapNode> findByArticleIdOrderByIdAsc(Long articleId);
    @Query("select n.article.id from KbMapNode n where n.article.id in :articleIds group by n.article.id")
    List<Long> findArticleIdsWithNodes(@Param("articleIds") List<Long> articleIds);
    @Query("select n from KbMapNode n where n.article.id in :articleIds order by n.article.id asc, n.id asc")
    List<KbMapNode> findByArticleIds(@Param("articleIds") List<Long> articleIds);
    void deleteByArticleId(Long articleId);
}
