package com.crdpls.api.controllers;

import com.crdpls.api.dto.*;
import com.crdpls.api.service.StaffService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/staff")
@CrossOrigin("*")
public class StaffController {

    private final StaffService staffService;

    public StaffController(StaffService staffService) {
        this.staffService = staffService;
    }

    @GetMapping
    public List<StaffUserDto> listUsers() {
        return staffService.listUsers();
    }

    @PostMapping
    public StaffUserDto createUser(@RequestBody StaffCreateUserRequest request) {
        return staffService.createUser(request);
    }

    @PutMapping("/{userId}/role")
    public StaffUserDto updateRole(@PathVariable Long userId, @RequestBody StaffRoleUpdateRequest request) {
        return staffService.updateRole(userId, request.role());
    }

    @PutMapping("/{userId}/status")
    public StaffUserDto updateStatus(
        @PathVariable Long userId,
        @RequestBody StaffStatusUpdateRequest request,
        Authentication authentication
    ) {
        return staffService.updateStatus(userId, request.status(), actorEmail(authentication));
    }

    @PutMapping("/{userId}/deactivate")
    public StaffUserDto deactivate(
        @PathVariable Long userId,
        @RequestBody(required = false) StaffDeactivateRequest request,
        Authentication authentication
    ) {
        String reason = request == null ? null : request.reason();
        return staffService.deactivate(userId, reason, actorEmail(authentication));
    }

    @PutMapping("/{userId}/activate")
    public StaffUserDto activate(@PathVariable Long userId, Authentication authentication) {
        return staffService.activate(userId, actorEmail(authentication));
    }

    @PutMapping("/{userId}/password")
    public StaffUserDto resetPassword(@PathVariable Long userId, @RequestBody StaffPasswordResetRequest request) {
        return staffService.resetPassword(userId, request.password());
    }

    private String actorEmail(Authentication authentication) {
        return authentication == null ? "unknown" : authentication.getName();
    }
}
