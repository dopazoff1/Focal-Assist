package com.crdpls.api.repository;

import com.crdpls.api.models.GmailAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GmailAccountRepository extends JpaRepository<GmailAccount, Long> {
    Optional<GmailAccount> findByUserId(Long userId);
    Optional<GmailAccount> findTopByOrderByIdAsc();
}
