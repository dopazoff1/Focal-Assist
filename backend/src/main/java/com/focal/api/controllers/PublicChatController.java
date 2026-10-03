package com.focal.api.controllers;

import com.focal.api.service.LiveChatService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/public/chat")
@CrossOrigin("*")
public class PublicChatController {
    private final LiveChatService liveChatService;

    public PublicChatController(LiveChatService liveChatService) {
        this.liveChatService = liveChatService;
    }

    @GetMapping("/{slug}")
    public Map<String, Object> project(@PathVariable String slug) {
        return liveChatService.getPublicProject(slug);
    }

    @PostMapping("/{slug}/sessions")
    public Map<String, Object> start(@PathVariable String slug, @RequestBody(required = false) Map<String, Object> request) {
        return liveChatService.startPublicSession(slug, request == null ? Map.of() : request);
    }

    @GetMapping("/sessions/{token}")
    public Map<String, Object> session(@PathVariable String token) {
        return liveChatService.getPublicSession(token);
    }

    @GetMapping("/sessions/{token}/messages")
    public List<Map<String, Object>> messages(@PathVariable String token) {
        return liveChatService.getPublicMessages(token);
    }

    @PostMapping("/sessions/{token}/messages")
    public Map<String, Object> send(@PathVariable String token, @RequestBody Map<String, Object> request) {
        return liveChatService.sendPublicMessage(token, request == null ? Map.of() : request);
    }

    @PostMapping("/sessions/{token}/csat")
    public Map<String, Object> csat(@PathVariable String token, @RequestBody(required = false) Map<String, Object> request) {
        return liveChatService.submitPublicCsat(token, request == null ? Map.of() : request);
    }
}
