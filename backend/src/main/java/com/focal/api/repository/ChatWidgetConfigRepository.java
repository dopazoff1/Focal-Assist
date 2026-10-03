package com.focal.api.repository;

import com.focal.api.models.ChatWidgetConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChatWidgetConfigRepository extends JpaRepository<ChatWidgetConfig, Long> {
    Optional<ChatWidgetConfig> findByUserId(Long userId);
    Optional<ChatWidgetConfig> findByWidgetToken(String widgetToken);
}
