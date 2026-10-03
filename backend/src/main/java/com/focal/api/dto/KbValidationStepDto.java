package com.focal.api.dto;

public record KbValidationStepDto(
        Long id,
        Integer stepOrder,
        KbValidationUserDto reviewer
) {}
