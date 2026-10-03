package com.focal.api.controllers;

import com.focal.api.dto.*;
import com.focal.api.models.User;
import com.focal.api.repository.UserRepository;
import com.focal.api.service.AstraKnowledgeService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/astra/kb")
@CrossOrigin("*")
public class AstraKbController {

    private final AstraKnowledgeService astraKnowledgeService;
    private final UserRepository userRepository;

    public AstraKbController(AstraKnowledgeService astraKnowledgeService, UserRepository userRepository) {
        this.astraKnowledgeService = astraKnowledgeService;
        this.userRepository = userRepository;
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(
        Authentication authentication,
        @RequestParam(name = "days", defaultValue = "30") int days
    ) {
        requireUser(authentication);
        return astraKnowledgeService.getDashboardOverview(days);
    }

    @GetMapping("/categories")
    public List<Map<String, Object>> categories(Authentication authentication) {
        requireUser(authentication);
        return astraKnowledgeService.listActiveCategories();
    }

    @GetMapping("/categories/{categoryId}/articles")
    public List<Map<String, Object>> articlesByCategory(Authentication authentication, @PathVariable Long categoryId) {
        requireUser(authentication);
        return astraKnowledgeService.listActiveArticlesByCategory(categoryId);
    }

    @GetMapping("/articles/{articleId}")
    public Map<String, Object> article(Authentication authentication, @PathVariable Long articleId) {
        requireUser(authentication);
        return astraKnowledgeService.getActiveArticle(articleId);
    }

    @PostMapping("/articles/{articleId}/view")
    public Map<String, Object> trackView(
        Authentication authentication,
        @PathVariable Long articleId,
        @RequestBody(required = false) AstraKbTrackViewRequestDto request
    ) {
        User user = requireUser(authentication);
        return astraKnowledgeService.trackArticleView(articleId, request, user);
    }

    @PostMapping("/articles/{articleId}/feedback")
    public Map<String, Object> feedback(
        Authentication authentication,
        @PathVariable Long articleId,
        @RequestBody AstraKbFeedbackRequestDto request
    ) {
        User user = requireUser(authentication);
        return astraKnowledgeService.submitArticleFeedback(articleId, request, user);
    }

    @GetMapping("/articles/{articleId}/feedback")
    public List<Map<String, Object>> articleFeedback(
        Authentication authentication,
        @PathVariable Long articleId,
        @RequestParam(name = "limit", defaultValue = "40") int limit
    ) {
        requireUser(authentication);
        return astraKnowledgeService.listArticleFeedback(articleId, limit);
    }

    @GetMapping("/tickets")
    public List<Map<String, Object>> tickets(Authentication authentication) {
        User user = requireUser(authentication);
        ensureTicketAccess(user);
        return astraKnowledgeService.listPublicTickets();
    }

    @PutMapping("/tickets/{ticketId}")
    public Map<String, Object> updateTicket(
        Authentication authentication,
        @PathVariable Long ticketId,
        @RequestBody AstraKbTicketUpdateRequestDto request
    ) {
        User user = requireUser(authentication);
        ensureTicketAccess(user);
        return astraKnowledgeService.updatePublicTicket(ticketId, request, user);
    }

    @GetMapping("/llm/integrations")
    public List<Map<String, Object>> llmIntegrations(Authentication authentication) {
        User user = requireUser(authentication);
        ensureIntegrationAccess(user);
        return astraKnowledgeService.listLlmIntegrations();
    }

    @PutMapping("/llm/integrations/{providerCode}")
    public Map<String, Object> updateIntegration(
        Authentication authentication,
        @PathVariable String providerCode,
        @RequestBody AstraLlmIntegrationUpsertRequestDto request
    ) {
        User user = requireUser(authentication);
        ensureIntegrationAccess(user);
        return astraKnowledgeService.upsertLlmIntegration(providerCode, request);
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
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is deactivated");
        }
        return user;
    }

    private void ensureTicketAccess(User user) {
        String role = normalizeRole(user);
        if (
            !"ADMIN".equals(role)
                && !"HEAD_CS".equals(role)
                && !"OPS".equals(role)
                && !"TEAM_LEADER".equals(role)
                && !"QA".equals(role)
                && !"AGENT".equals(role)
        ) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
    }

    private void ensureIntegrationAccess(User user) {
        String role = normalizeRole(user);
        if (!"ADMIN".equals(role) && !"HEAD_CS".equals(role) && !"OPS".equals(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
    }

    private String normalizeRole(User user) {
        String raw = user == null || user.getRole() == null ? "" : user.getRole().trim().toUpperCase();
        if (raw.equals("1") || raw.equals("ROLE_ADMIN")) return "ADMIN";
        if (raw.equals("2") || raw.equals("ROLE_AGENT")) return "AGENT";
        if (raw.equals("3") || raw.equals("ROLE_TEAM_LEADER") || raw.equals("TL")) return "TEAM_LEADER";
        if (raw.equals("4") || raw.equals("ROLE_QA") || raw.equals("QUALITY")) return "QA";
        if (raw.equals("5") || raw.equals("ROLE_HEAD_CS") || raw.equals("ROLE_HEAD_OF_CS")) return "HEAD_CS";
        if (raw.equals("6") || raw.equals("ROLE_OPS")) return "OPS";
        return raw;
    }
}

