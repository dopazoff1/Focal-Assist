package com.focal.api.repository;

import com.focal.api.models.RoleAccessLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoleAccessLinkRepository extends JpaRepository<RoleAccessLink, Long> {
    List<RoleAccessLink> findAllByOrderByRoleNameAscFeatureKeyAsc();
    void deleteByRoleName(String roleName);
}

