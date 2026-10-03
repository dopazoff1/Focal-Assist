package com.focal.api.repository;

import com.focal.api.models.RoleAccessProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoleAccessProfileRepository extends JpaRepository<RoleAccessProfile, Long> {
    List<RoleAccessProfile> findAllByOrderBySystemRoleDescNameAsc();
    Optional<RoleAccessProfile> findByName(String name);
}

