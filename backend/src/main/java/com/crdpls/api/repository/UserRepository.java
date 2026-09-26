package com.crdpls.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.crdpls.api.models.User;

import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {
    User findByEmail(String email);
    List<User> findByActiveTrueOrderByFirstNameAscLastNameAsc();
    long countByActiveTrue();

    @Query(value = """
        SELECT *
        FROM users u
        WHERE u.active = 1
          AND UPPER(COALESCE(u.status, 'OFFLINE')) = 'ONLINE'
          AND (
            UPPER(COALESCE(u.role, '')) = 'AGENT'
            OR UPPER(COALESCE(u.role, '')) = 'ROLE_AGENT'
            OR UPPER(COALESCE(u.role, '')) = '2'
          )
        ORDER BY u.id ASC
    """, nativeQuery = true)
    List<User> findOnlineAgents();
}
