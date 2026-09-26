package com.crdpls.api.repository;

import com.crdpls.api.models.KbArticleTimeLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface KbArticleTimeLogRepository extends JpaRepository<KbArticleTimeLog, Long> {
    List<KbArticleTimeLog> findByTrackedAtAfterOrderByTrackedAtDesc(LocalDateTime since);
}
