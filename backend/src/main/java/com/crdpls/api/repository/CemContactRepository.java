package com.crdpls.api.repository;

import com.crdpls.api.models.CemContact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CemContactRepository extends JpaRepository<CemContact, Long> {
    Optional<CemContact> findByPrimaryEmailIgnoreCase(String primaryEmail);
}
