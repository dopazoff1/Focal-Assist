package com.crdpls.api.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record StaffUserDto(
    Long id,
    String firstName,
    String lastName,
    LocalDate dob,
    String email,
    String role,
    String status,
    boolean active,
    String deactivationReason,
    LocalDateTime deactivatedAt
) {}
