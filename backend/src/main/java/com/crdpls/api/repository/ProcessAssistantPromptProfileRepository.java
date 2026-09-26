package com.crdpls.api.repository;

import com.crdpls.api.models.ProcessAssistantPromptProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessAssistantPromptProfileRepository extends JpaRepository<ProcessAssistantPromptProfile, Long> {
    List<ProcessAssistantPromptProfile> findAllByOrderByIdAsc();
}

