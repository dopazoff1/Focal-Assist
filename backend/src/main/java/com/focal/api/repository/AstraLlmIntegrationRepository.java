package com.focal.api.repository;

import com.focal.api.models.AstraLlmIntegration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AstraLlmIntegrationRepository extends JpaRepository<AstraLlmIntegration, Long> {
    List<AstraLlmIntegration> findAllByOrderByProviderNameAsc();
    Optional<AstraLlmIntegration> findByProviderCodeIgnoreCase(String providerCode);
}

