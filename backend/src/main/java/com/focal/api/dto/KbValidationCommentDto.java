package com.focal.api.dto;

import java.time.LocalDateTime;

public record KbValidationCommentDto(
        Long id,
        String selector,
        String selectedText,
        String comment,
        KbValidationUserDto author,
        LocalDateTime createdAt
) {}
