package com.focal.api.dto;

public record ChatInboundMessageRequestDto(
    String channel,
    String externalThreadId,
    String customerName,
    String customerHandle,
    String text
) {}
