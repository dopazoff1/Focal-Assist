package com.crdpls.api.dto;

import com.crdpls.api.models.KbRevisionStatus;

import java.time.LocalDateTime;
import java.util.List;

public record KbArticleDraftDto(
        Long revisionId,
        Long articleId,
        String title,
        String content,
        Long categoryId,
        String categoryName,
        Integer displayOrder,
        Boolean requestedActive,
        KbRevisionStatus status,
        Integer currentStep,
        String rejectionReason,
        LocalDateTime submittedAt,
        List<KbValidationStepDto> validationChain,
        List<KbValidationCommentDto> comments
) {}
