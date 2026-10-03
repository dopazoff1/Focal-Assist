package com.focal.api.repository;

import com.focal.api.models.ProcessAssistantPromptProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessAssistantPromptProfileRepository extends JpaRepository<ProcessAssistantPromptProfile, Long> {
    List<ProcessAssistantPromptProfile> findAllByOrderByIdAsc();
}

