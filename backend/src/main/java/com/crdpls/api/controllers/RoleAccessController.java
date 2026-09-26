package com.crdpls.api.controllers;

import com.crdpls.api.dto.RoleAccessConfigDto;
import com.crdpls.api.dto.RoleAccessCreateRoleRequestDto;
import com.crdpls.api.dto.RoleAccessProfileDto;
import com.crdpls.api.models.User;
import com.crdpls.api.repository.UserRepository;
import com.crdpls.api.service.RoleAccessService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/access-control")
@CrossOrigin("*")
public class RoleAccessController {

    private final RoleAccessService roleAccessService;
    private final UserRepository userRepository;

    public RoleAccessController(RoleAccessService roleAccessService, UserRepository userRepository) {
        this.roleAccessService = roleAccessService;
        this.userRepository = userRepository;
    }

    @GetMapping("/config")
    public RoleAccessConfigDto getConfig(Authentication authentication) {
        requireUser(authentication);
        return roleAccessService.getConfig();
    }

    @PutMapping("/config")
    public RoleAccessConfigDto saveConfig(
        Authentication authentication,
        @RequestBody RoleAccessConfigDto request
    ) {
        User user = requireUser(authentication);
        ensureAdmin(user);
        return roleAccessService.saveConfig(request);
    }

    @PostMapping("/roles")
    public RoleAccessProfileDto createRole(
        Authentication authentication,
        @RequestBody RoleAccessCreateRoleRequestDto request
    ) {
        User user = requireUser(authentication);
        ensureAdmin(user);
        String name = request == null ? null : request.getName();
        String description = request == null ? null : request.getDescription();
        return roleAccessService.createRole(name, description);
    }

    @DeleteMapping("/roles/{roleName}")
    public void deleteRole(
        Authentication authentication,
        @PathVariable String roleName
    ) {
        User user = requireUser(authentication);
        ensureAdmin(user);
        roleAccessService.deleteRole(roleName);
    }

    private User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        User user = userRepository.findByEmail(authentication.getName());
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found");
        }
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is deactivated");
        }
        return user;
    }

    private void ensureAdmin(User user) {
        String role = user == null || user.getRole() == null ? "" : user.getRole().trim().toUpperCase();
        if (role.equals("ROLE_ADMIN") || role.equals("ADMIN") || role.equals("1") || role.equals("ROLE_1")) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
    }
}

