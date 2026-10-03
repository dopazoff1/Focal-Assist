package com.focal.api.dto;

public record KbHubCategoryDto(
        Long id,
        String name,
        long articleCount
) {}
