package com.crdpls.api.controllers;

import com.crdpls.api.dto.*;
import com.crdpls.api.models.User;
import com.crdpls.api.repository.UserRepository;
import com.crdpls.api.service.ProcessAssistantService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/process-assistant")
@CrossOrigin("*")
public class ProcessAssistantController {

    private final ProcessAssistantService processAssistantService;
    private final UserRepository userRepository;

    public ProcessAssistantController(ProcessAssistantService processAssistantService, UserRepository userRepository) {
        this.processAssistantService = processAssistantService;
        this.userRepository = userRepository;
    }

    @GetMapping("/prompt-map")
    public ProcessAssistantPromptMapResponseDto getPromptMap(Authentication authentication) {
        requireUser(authentication);
        return processAssistantService.getPromptMap();
    }

    @RequestMapping(path = {"/prompt-map/save", "/prompt-map"}, method = {RequestMethod.POST, RequestMethod.PUT})
    public ProcessAssistantPromptMapResponseDto savePromptMap(
        Authentication authentication,
        @RequestBody ProcessAssistantPromptMapSaveRequestDto request
    ) {
        User user = requireUser(authentication);
        if (!isAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
        return processAssistantService.savePromptMap(request);
    }

    @GetMapping("/conversations")
    public List<ProcessAssistantConversationDto> listConversations(Authentication authentication) {
        User user = requireUser(authentication);
        return processAssistantService.listConversations(user);
    }

    @PostMapping("/conversations")
    public ProcessAssistantConversationDto createConversation(
        Authentication authentication,
        @RequestBody(required = false) ProcessAssistantCreateConversationRequestDto request
    ) {
        User user = requireUser(authentication);
        return processAssistantService.createConversation(user, request);
    }

    @DeleteMapping("/conversations/{conversationId}")
    public void deleteConversation(Authentication authentication, @PathVariable Long conversationId) {
        User user = requireUser(authentication);
        processAssistantService.deleteConversation(user, conversationId);
    }

    @PutMapping("/conversations/{conversationId}/prompt")
    public ProcessAssistantConversationDto setConversationPrompt(
        Authentication authentication,
        @PathVariable Long conversationId,
        @RequestBody ProcessAssistantSetPromptRequestDto request
    ) {
        User user = requireUser(authentication);
        Long promptProfileId = request == null ? null : request.getPromptProfileId();
        return processAssistantService.setConversationPrompt(user, conversationId, promptProfileId);
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public List<ProcessAssistantMessageDto> listMessages(Authentication authentication, @PathVariable Long conversationId) {
        User user = requireUser(authentication);
        return processAssistantService.listMessages(user, conversationId);
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public ProcessAssistantSendMessageResponseDto sendMessage(
        Authentication authentication,
        @PathVariable Long conversationId,
        @RequestBody ProcessAssistantSendMessageRequestDto request
    ) {
        User user = requireUser(authentication);
        return processAssistantService.sendMessage(user, conversationId, request);
    }

    @PostMapping("/respond")
    public ProcessAssistantRespondResponseDto respond(
        Authentication authentication,
        @RequestBody ProcessAssistantRespondRequestDto request
    ) {
        requireUser(authentication);
        return processAssistantService.respond(request);
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

    private boolean isAdmin(User user) {
        String role = user == null || user.getRole() == null ? "" : user.getRole().trim().toUpperCase();
        return role.equals("ADMIN") || role.equals("ROLE_ADMIN") || role.equals("1") || role.equals("ROLE_1");
    }
}

