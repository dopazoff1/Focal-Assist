package com.focal.api.dto;

public record KbHubArticleSummaryDto(
        Long id,
        String title,
        Long categoryId,
        String categoryName,
        Integer displayOrder,
        Boolean isActive,
        boolean hasMap
) {}
