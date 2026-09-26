package com.crdpls.api.repository;

import com.crdpls.api.models.CollaborationUserPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CollaborationUserPreferenceRepository extends JpaRepository<CollaborationUserPreference, Long> {
    Optional<CollaborationUserPreference> findByUserId(Long userId);
}

