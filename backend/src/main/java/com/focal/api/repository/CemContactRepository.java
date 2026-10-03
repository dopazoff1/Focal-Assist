package com.focal.api.repository;

import com.focal.api.models.CemContact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CemContactRepository extends JpaRepository<CemContact, Long> {
    Optional<CemContact> findByPrimaryEmailIgnoreCase(String primaryEmail);
}
