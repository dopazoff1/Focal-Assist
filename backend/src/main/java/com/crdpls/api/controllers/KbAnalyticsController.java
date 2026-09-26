package com.crdpls.api.controllers;

import com.crdpls.api.dto.KbTrackTimeRequestDto;
import com.crdpls.api.models.User;
import com.crdpls.api.repository.UserRepository;
import com.crdpls.api.service.KbAnalyticsService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/kb/analytics")
@CrossOrigin("*")
public class KbAnalyticsController {

    private final KbAnalyticsService kbAnalyticsService;
    private final UserRepository userRepository;

    public KbAnalyticsController(
        KbAnalyticsService kbAnalyticsService,
        UserRepository userRepository
    ) {
        this.kbAnalyticsService = kbAnalyticsService;
        this.userRepository = userRepository;
    }

    @PostMapping("/track-time")
    public Map<String, Object> trackTime(
        Authentication authentication,
        @RequestBody KbTrackTimeRequestDto request
    ) {
        User user = requireUser(authentication);
        return kbAnalyticsService.trackTime(user, request);
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(
        Authentication authentication,
        @RequestParam(name = "days", defaultValue = "30") int days
    ) {
        requireUser(authentication);
        return kbAnalyticsService.dashboard(days);
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
}
