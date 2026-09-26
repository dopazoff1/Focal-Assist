package com.crdpls.api.repository;

import com.crdpls.api.models.ChatParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatParticipantRepository extends JpaRepository<ChatParticipant, Long> {
}
