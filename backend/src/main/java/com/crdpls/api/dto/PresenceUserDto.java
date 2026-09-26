package com.crdpls.api.dto;

public record PresenceUserDto(
    Long id,
    String firstName,
    String lastName,
    String email,
    String status,
    boolean active
) {}
