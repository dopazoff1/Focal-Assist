package com.crdpls.api.controllers;

import com.crdpls.api.service.GmailService;
import com.crdpls.api.security.JwtService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Map;

@RestController
@RequestMapping("/api/gmail")
@CrossOrigin("*")
public class GmailController {

    private final GmailService gmailService;
    private final JwtService jwtService;

    public GmailController(GmailService gmailService, JwtService jwtService) {
        this.gmailService = gmailService;
        this.jwtService = jwtService;
    }

    @GetMapping("/oauth/url/{userId}")
    public Map<String, String> getOAuthUrl(@PathVariable Long userId) {
        return gmailService.getOAuthUrl(userId);
    }

    @GetMapping("/oauth/callback")
    public Map<String, Object> oauthCallback(
        @RequestParam(required = false) String code,
        @RequestParam(required = false) String state,
        @RequestParam(required = false) String error
    ) {
        return gmailService.handleOAuthCallback(code, state, error);
    }

    @PostMapping("/sync/{userId}")
    public Map<String, Object> syncInbox(@PathVariable Long userId) {
        return gmailService.syncInbox(userId);
    }

    @GetMapping("/thread/{userId}/{conversationId}")
    public Map<String, Object> getThread(
        @PathVariable Long userId,
        @PathVariable Long conversationId
    ) {
        return gmailService.getThread(userId, conversationId);
    }

    @PostMapping("/reply/{userId}/{conversationId}")
    public Map<String, Object> sendReply(
        @PathVariable Long userId,
        @PathVariable Long conversationId,
        @RequestBody Map<String, String> payload
    ) {
        return gmailService.sendReply(userId, conversationId, payload.getOrDefault("reply", ""));
    }

    @GetMapping("/attachment/{userId}/{messageId}/{attachmentId}")
    public ResponseEntity<byte[]> getAttachment(
        @PathVariable Long userId,
        @PathVariable String messageId,
        @PathVariable String attachmentId,
        @RequestParam(required = false, defaultValue = "application/octet-stream") String mimeType,
        @RequestParam(required = false, defaultValue = "attachment.bin") String filename,
        @RequestParam(required = false) String token
    ) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean hasAuth = auth != null && auth.isAuthenticated() && !"anonymousUser".equalsIgnoreCase(String.valueOf(auth.getPrincipal()));
        if (!hasAuth && !jwtService.isAttachmentTokenValid(token, userId, messageId, attachmentId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
        GmailService.AttachmentPayload payload = gmailService.getAttachmentPayload(userId, messageId, attachmentId);
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(mimeType);
        } catch (Exception ex) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
            .contentType(mediaType)
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
            .body(payload.data());
    }
}
