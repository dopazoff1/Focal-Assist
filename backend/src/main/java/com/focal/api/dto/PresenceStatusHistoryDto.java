package com.focal.api.dto;

import java.time.LocalDateTime;

public record PresenceStatusHistoryDto(
    Long id,
    Long userId,
    String userName,
    String status,
    LocalDateTime changedAt,
    String changedByEmail,
    String changeSource,
    String note
) {}
