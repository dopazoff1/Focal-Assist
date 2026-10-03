package com.focal.api.controllers;

import com.focal.api.models.ChatProjectApiKey;
import com.focal.api.service.ChatProjectService;
import com.focal.api.service.LiveChatService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/chat-project-api")
@CrossOrigin("*")
public class ChatProjectApiController {
    private final ChatProjectService chatProjectService;
    private final LiveChatService liveChatService;

    public ChatProjectApiController(ChatProjectService chatProjectService, LiveChatService liveChatService) {
        this.chatProjectService = chatProjectService;
        this.liveChatService = liveChatService;
    }

    @PostMapping("/sessions")
    public Map<String, Object> createSession(
        @RequestHeader(value = "X-Chat-Api-Key", required = false) String apiKey,
        @RequestBody(required = false) Map<String, Object> request
    ) {
        ChatProjectApiKey key = chatProjectService.validateApiKey(apiKey)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid project API key."));
        return liveChatService.externalStartSession(key, request == null ? Map.of() : request);
    }
}
