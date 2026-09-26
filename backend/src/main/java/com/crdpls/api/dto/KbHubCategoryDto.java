package com.crdpls.api.dto;

public record KbHubCategoryDto(
        Long id,
        String name,
        long articleCount
) {}
