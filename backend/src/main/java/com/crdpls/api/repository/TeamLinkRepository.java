package com.crdpls.api.repository;

import com.crdpls.api.models.TeamLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TeamLinkRepository extends JpaRepository<TeamLink, Long> {
    List<TeamLink> findAllByOrderByManagerRoleAscManagerIdAscAgentIdAsc();
    void deleteByManagerRoleAndManagerId(String managerRole, Long managerId);
    List<TeamLink> findByAgentId(Long agentId);
}
