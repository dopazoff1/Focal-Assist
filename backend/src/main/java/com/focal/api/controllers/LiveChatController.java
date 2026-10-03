package com.focal.api.controllers;

import com.focal.api.models.User;
import com.focal.api.repository.UserRepository;
import com.focal.api.service.LiveChatService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/live-chat")
@CrossOrigin("*")
public class LiveChatController {
    private final LiveChatService liveChatService;
    private final UserRepository userRepository;

    public LiveChatController(LiveChatService liveChatService, UserRepository userRepository) {
        this.liveChatService = liveChatService;
        this.userRepository = userRepository;
    }

    @GetMapping("/sessions")
    public List<Map<String, Object>> sessions(
        Authentication authentication,
        @RequestParam(required = false) Long projectId,
        @RequestParam(required = false) Long queueId,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) Long agentId
    ) {
        return liveChatService.searchSessions(requireUser(authentication), projectId, queueId, status, agentId);
    }

    @PostMapping("/claim-next")
    public Map<String, Object> claimNext(Authentication authentication, @RequestBody(required = false) Map<String, Object> request) {
        Long projectId = asLong(request == null ? null : request.get("projectId"));
        return liveChatService.claimNext(requireUser(authentication), projectId);
    }

    @PostMapping("/sessions/{sessionId}/assign")
    public Map<String, Object> assign(Authentication authentication, @PathVariable Long sessionId, @RequestBody Map<String, Object> request) {
        Long agentId = asLong(request == null ? null : request.get("agentId"));
        if (agentId == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "agentId is required.");
        return liveChatService.assignSessionToAgent(requireUser(authentication), sessionId, agentId);
    }

    @GetMapping("/sessions/{sessionId}/messages")
    public List<Map<String, Object>> messages(Authentication authentication, @PathVariable Long sessionId) {
        return liveChatService.getMessages(requireUser(authentication), sessionId);
    }

    @PostMapping("/sessions/{sessionId}/messages")
    public Map<String, Object> sendMessage(Authentication authentication, @PathVariable Long sessionId, @RequestBody Map<String, Object> request) {
        return liveChatService.sendAgentMessage(requireUser(authentication), sessionId, request == null ? Map.of() : request);
    }

    @PostMapping("/sessions/{sessionId}/close")
    public Map<String, Object> close(Authentication authentication, @PathVariable Long sessionId) {
        return liveChatService.closeSession(requireUser(authentication), sessionId);
    }

    @PostMapping("/sessions/{sessionId}/typing")
    public Map<String, Object> typing(Authentication authentication, @PathVariable Long sessionId, @RequestBody(required = false) Map<String, Object> request) {
        boolean typing = Boolean.TRUE.equals(request == null ? false : request.get("typing"));
        return liveChatService.setTyping(requireUser(authentication), sessionId, typing);
    }

    private User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        User user = userRepository.findByEmail(authentication.getName());
        if (user == null || !Boolean.TRUE.equals(user.getActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is inactive.");
        }
        return user;
    }

    private Long asLong(Object value) {
        if (value instanceof Number n) return n.longValue();
        try { return Long.parseLong(String.valueOf(value)); } catch (Exception ex) { return null; }
    }
}
