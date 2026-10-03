package com.focal.api.repository;

import com.focal.api.models.ChatProjectApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatProjectApiKeyRepository extends JpaRepository<ChatProjectApiKey, Long> {
    List<ChatProjectApiKey> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    Optional<ChatProjectApiKey> findByTokenHashAndActiveTrue(String tokenHash);
    void deleteByProjectId(Long projectId);
}
