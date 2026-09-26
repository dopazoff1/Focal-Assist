package com.crdpls.api.dto;

public record ChatWidgetInboundRequestDto(
    String externalThreadId,
    String visitorName,
    String visitorHandle,
    String text
) {}
