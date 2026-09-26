package com.crdpls.api.dto;

import java.time.LocalDateTime;

public record KbValidationQueueItemDto(
        Long revisionId,
        Long articleId,
        String title,
        String categoryName,
        String makerName,
        LocalDateTime submittedAt,
        Integer currentStep,
        Integer totalSteps
) {}
