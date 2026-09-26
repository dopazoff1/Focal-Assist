package com.crdpls.api.dto;

public record KbValidationStepDto(
        Long id,
        Integer stepOrder,
        KbValidationUserDto reviewer
) {}
