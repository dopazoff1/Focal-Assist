package com.crdpls.api.repository;

import com.crdpls.api.models.KbArticleRevision;
import com.crdpls.api.models.KbRevisionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Optional;
import java.util.List;

public interface KbArticleRevisionRepository extends JpaRepository<KbArticleRevision, Long> {
    @Query(value = "select * from kb_article_revisions where id = :revisionId for update", nativeQuery = true)
    Optional<KbArticleRevision> findByIdForUpdate(@Param("revisionId") Long revisionId);

    List<KbArticleRevision> findByArticleIdOrderByIdAsc(Long articleId);
    Optional<KbArticleRevision> findFirstByArticleIdAndCreatedByIdAndStatusInOrderByIdDesc(
            Long articleId, Long createdById, Collection<KbRevisionStatus> statuses);

    Optional<KbArticleRevision> findFirstByArticleIdAndStatusInOrderByIdDesc(
            Long articleId, Collection<KbRevisionStatus> statuses);
}
