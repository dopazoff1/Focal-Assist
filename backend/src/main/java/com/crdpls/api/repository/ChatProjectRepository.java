package com.crdpls.api.repository;

import com.crdpls.api.models.ChatProject;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatProjectRepository extends JpaRepository<ChatProject, Long> {
    Optional<ChatProject> findBySlug(String slug);
    boolean existsBySlug(String slug);
    List<ChatProject> findAllByOrderByUpdatedAtDesc();
    List<ChatProject> findByStatusNotOrderByUpdatedAtDesc(String status);
}
