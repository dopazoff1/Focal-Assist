package com.focal.api.repository;

import com.focal.api.models.KbArticleTimeLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface KbArticleTimeLogRepository extends JpaRepository<KbArticleTimeLog, Long> {
    List<KbArticleTimeLog> findByTrackedAtAfterOrderByTrackedAtDesc(LocalDateTime since);
}
