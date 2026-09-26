package com.crdpls.api.repository;

import com.crdpls.api.models.KbValidationChainStep;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KbValidationChainStepRepository extends JpaRepository<KbValidationChainStep, Long> {
    List<KbValidationChainStep> findAllByOrderByStepOrderAsc();
}
