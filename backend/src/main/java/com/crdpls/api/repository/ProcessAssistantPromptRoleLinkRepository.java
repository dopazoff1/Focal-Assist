package com.crdpls.api.repository;

import com.crdpls.api.models.ProcessAssistantPromptRoleLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessAssistantPromptRoleLinkRepository extends JpaRepository<ProcessAssistantPromptRoleLink, Long> {
    List<ProcessAssistantPromptRoleLink> findAllByOrderByRoleAscPromptProfileIdAsc();
}

