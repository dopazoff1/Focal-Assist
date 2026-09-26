package com.crdpls.api.repository;

import com.crdpls.api.models.ChatChannelLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatChannelLinkRepository extends JpaRepository<ChatChannelLink, Long> {
    List<ChatChannelLink> findByUserIdOrderByChannelTypeAsc(Long userId);
    Optional<ChatChannelLink> findByUserIdAndChannelType(Long userId, String channelType);
}
