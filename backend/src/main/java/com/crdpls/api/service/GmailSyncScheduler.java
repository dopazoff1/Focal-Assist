package com.crdpls.api.service;

import com.crdpls.api.models.GmailAccount;
import com.crdpls.api.repository.GmailAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class GmailSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(GmailSyncScheduler.class);

    private final GmailAccountRepository gmailAccountRepository;
    private final GmailService gmailService;

    public GmailSyncScheduler(GmailAccountRepository gmailAccountRepository, GmailService gmailService) {
        this.gmailAccountRepository = gmailAccountRepository;
        this.gmailService = gmailService;
    }

    @Scheduled(fixedDelay = 5000)
    public void syncPanelMailboxEveryFiveSeconds() {
        GmailAccount account = gmailAccountRepository.findTopByOrderByIdAsc().orElse(null);
        if (account == null || account.getUser() == null || account.getUser().getId() == null) {
            return;
        }
        Long ownerUserId = account.getUser().getId();
        try {
            gmailService.syncInbox(ownerUserId);
        } catch (Exception ex) {
            log.warn("Auto Gmail sync failed for panel mailbox owner {}: {}", ownerUserId, ex.getMessage());
        }
    }
}
