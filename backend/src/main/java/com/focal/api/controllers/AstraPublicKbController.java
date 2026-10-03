package com.focal.api.controllers;

import com.focal.api.dto.AstraKbFeedbackRequestDto;
import com.focal.api.dto.AstraKbPublicTicketCreateRequestDto;
import com.focal.api.dto.AstraKbTrackViewRequestDto;
import com.focal.api.service.AstraKnowledgeService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/public/astra/kb")
@CrossOrigin("*")
public class AstraPublicKbController {

    private final AstraKnowledgeService astraKnowledgeService;

    public AstraPublicKbController(AstraKnowledgeService astraKnowledgeService) {
        this.astraKnowledgeService = astraKnowledgeService;
    }

    @GetMapping("/categories")
    public List<Map<String, Object>> categories() {
        return astraKnowledgeService.listActiveCategories();
    }

    @GetMapping("/categories/{categoryId}/articles")
    public List<Map<String, Object>> articlesByCategory(@PathVariable Long categoryId) {
        return astraKnowledgeService.listActiveArticlesByCategory(categoryId);
    }

    @GetMapping("/articles/{articleId}")
    public Map<String, Object> article(@PathVariable Long articleId) {
        return astraKnowledgeService.getActiveArticle(articleId);
    }

    @PostMapping("/articles/{articleId}/view")
    public Map<String, Object> trackView(
        @PathVariable Long articleId,
        @RequestBody(required = false) AstraKbTrackViewRequestDto request
    ) {
        return astraKnowledgeService.trackArticleView(articleId, request, null);
    }

    @PostMapping("/articles/{articleId}/feedback")
    public Map<String, Object> feedback(
        @PathVariable Long articleId,
        @RequestBody AstraKbFeedbackRequestDto request
    ) {
        return astraKnowledgeService.submitArticleFeedback(articleId, request, null);
    }

    @PostMapping("/tickets")
    public Map<String, Object> createTicket(@RequestBody AstraKbPublicTicketCreateRequestDto request) {
        return astraKnowledgeService.createPublicTicket(request);
    }
}

