package com.focal.api.repository;

import com.focal.api.models.KbArticle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface KbArticleRepository extends JpaRepository<KbArticle, Long> {

    List<KbArticle> findByCategoryIdAndIsActiveTrueOrderByDisplayOrderAsc(Long categoryId);
    List<KbArticle> findByCategoryIdOrderByDisplayOrderAsc(Long categoryId);
    List<KbArticle> findAllByOrderByDisplayOrderAscIdAsc();

    @Query("""
            select a.id as id,
                   a.title as title,
                   a.displayOrder as displayOrder,
                   a.isActive as isActive,
                   c.id as categoryId,
                   c.name as categoryName
            from KbArticle a
            join a.category c
            where a.isActive = true
              and c.isActive = true
            order by c.displayOrder asc, c.id asc, a.displayOrder asc, a.id asc
            """)
    List<KbArticleSummaryProjection> findActiveHubSummaries();

    @Query("""
            select distinct a
            from KbArticle a
            join fetch a.category c
            where a.isActive = true
              and c.isActive = true
              and (
                lower(a.title) like lower(concat('%', :term, '%'))
                or a.content like concat('%', :term, '%')
                or lower(c.name) like lower(concat('%', :term, '%'))
                or exists (
                    select n.id from KbMapNode n
                    where n.article.id = a.id
                      and (
                        lower(n.title) like lower(concat('%', :term, '%'))
                        or lower(n.label) like lower(concat('%', :term, '%'))
                        or n.content like concat('%', :term, '%')
                      )
                )
                or exists (
                    select e.id from KbMapEdge e
                    where e.article.id = a.id
                      and lower(e.label) like lower(concat('%', :term, '%'))
                )
              )
            order by c.displayOrder asc, c.id asc, a.displayOrder asc, a.id asc
            """)
    List<KbArticle> searchActiveHubArticles(@Param("term") String term, Pageable pageable);
}
