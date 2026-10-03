package com.focal.api.dto;

import java.time.LocalDate;

public record StaffCreateUserRequest(
    String firstName,
    String lastName,
    LocalDate dob,
    String email,
    String password,
    String role
) {}
