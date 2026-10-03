package com.focal.api.controllers;

import com.focal.api.models.User;
import com.focal.api.repository.UserRepository;
import com.focal.api.service.JiraBridgeService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/jira")
@CrossOrigin("*")
public class JiraBridgeController {

    private final JiraBridgeService jiraBridgeService;
    private final UserRepository userRepository;

    public JiraBridgeController(JiraBridgeService jiraBridgeService, UserRepository userRepository) {
        this.jiraBridgeService = jiraBridgeService;
        this.userRepository = userRepository;
    }

    @GetMapping("/test")
    public Map<String, Object> testConnection() {
        return jiraBridgeService.testConnection(getCurrentUserOrThrow());
    }

    @PostMapping("/issues/from-ticket")
    public Map<String, Object> createIssueFromTicket(@RequestBody Map<String, Object> payload) {
        return jiraBridgeService.createIssueFromTicket(getCurrentUserOrThrow(), payload == null ? Map.of() : payload);
    }

    @GetMapping("/issues/{issueKey}")
    public Map<String, Object> getIssue(@PathVariable String issueKey) {
        return jiraBridgeService.getIssue(getCurrentUserOrThrow(), issueKey);
    }

    @GetMapping("/issues/{issueKey}/transitions")
    public Map<String, Object> getTransitions(@PathVariable String issueKey) {
        return jiraBridgeService.getTransitions(getCurrentUserOrThrow(), issueKey);
    }

    @PostMapping("/issues/{issueKey}/transitions")
    public Map<String, Object> transitionIssue(
        @PathVariable String issueKey,
        @RequestBody Map<String, String> payload
    ) {
        String transitionId = payload == null ? "" : payload.getOrDefault("transitionId", "");
        jiraBridgeService.transitionIssue(getCurrentUserOrThrow(), issueKey, transitionId);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ok", true);
        return response;
    }

    @PostMapping("/issues/{issueKey}/comments")
    public Map<String, Object> addComment(
        @PathVariable String issueKey,
        @RequestBody Map<String, String> payload
    ) {
        String body = payload == null ? "" : payload.getOrDefault("body", "");
        jiraBridgeService.addComment(getCurrentUserOrThrow(), issueKey, body);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ok", true);
        return response;
    }

    private User getCurrentUserOrThrow() {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        User user = userRepository.findByEmail(auth.getName());
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is deactivated");
        }
        return user;
    }
}

