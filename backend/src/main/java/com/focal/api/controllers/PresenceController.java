package com.focal.api.controllers;

import com.focal.api.dto.PresenceStatusHistoryDto;
import com.focal.api.dto.PresenceUserDto;
import com.focal.api.dto.StaffStatusUpdateRequest;
import com.focal.api.models.User;
import com.focal.api.models.UserStatus;
import com.focal.api.repository.UserRepository;
import com.focal.api.service.PresenceTimelineService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/presence")
@CrossOrigin("*")
public class PresenceController {

    private final UserRepository userRepository;
    private final PresenceTimelineService presenceTimelineService;

    public PresenceController(UserRepository userRepository, PresenceTimelineService presenceTimelineService) {
        this.userRepository = userRepository;
        this.presenceTimelineService = presenceTimelineService;
    }

    @GetMapping("/statuses")
    public Set<String> statuses() {
        return UserStatus.allowed();
    }

    @GetMapping("/users")
    public List<PresenceUserDto> users() {
        return userRepository.findAll()
            .stream()
            .sorted(Comparator.comparing(User::getId))
            .map(this::toPresenceDto)
            .toList();
    }

    @GetMapping("/me")
    public PresenceUserDto me(Authentication authentication) {
        User user = currentUser(authentication);
        return toPresenceDto(user);
    }

    @PutMapping("/me")
    @Transactional
    public PresenceUserDto updateMyStatus(Authentication authentication, @RequestBody StaffStatusUpdateRequest request) {
        User user = currentUser(authentication);
        try {
            user.setStatus(UserStatus.normalize(request == null ? null : request.status()));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
        User saved = userRepository.save(user);
        presenceTimelineService.record(saved, saved.getStatus(), saved.getEmail(), "SELF", null);
        return toPresenceDto(saved);
    }

    @GetMapping("/timeline")
    public List<PresenceStatusHistoryDto> timeline(
        Authentication authentication,
        @RequestParam(required = false) Long userId
    ) {
        User current = currentUser(authentication);
        boolean supervisor = isSupervisor(current);

        if (!supervisor) {
            Long currentUserId = current.getId();
            if (userId != null && !userId.equals(currentUserId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
            }
            return presenceTimelineService.list(currentUserId);
        }

        return presenceTimelineService.list(userId);
    }

    private User currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        User user = userRepository.findByEmail(authentication.getName());
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found");
        }
        return user;
    }

    private PresenceUserDto toPresenceDto(User user) {
        return new PresenceUserDto(
            user.getId(),
            user.getFirstName(),
            user.getLastName(),
            user.getEmail(),
            UserStatus.normalize(user.getStatus()),
            Boolean.TRUE.equals(user.getActive())
        );
    }

    private boolean isSupervisor(User user) {
        String role = user == null || user.getRole() == null ? "" : user.getRole().trim().toUpperCase();
        return role.equals("ADMIN") || role.equals("ROLE_ADMIN") || role.equals("1") || role.equals("ROLE_1");
    }
}
