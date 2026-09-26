package com.crdpls.api.dto;

public record KbHubSearchResultDto(
        Long id,
        String title,
        Long categoryId,
        String categoryName,
        Integer displayOrder,
        Boolean isActive,
        boolean hasMap,
        String snippet
) {}
