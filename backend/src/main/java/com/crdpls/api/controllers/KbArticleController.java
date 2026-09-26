package com.crdpls.api.controllers;

import com.crdpls.api.dto.KbArticleCreateRequestDto;
import com.crdpls.api.dto.KbArticleDraftDto;
import com.crdpls.api.dto.KbArticleDraftRequestDto;
import com.crdpls.api.models.KbArticle;
import com.crdpls.api.models.User;
import com.crdpls.api.service.KbArticleService;
import com.crdpls.api.service.KbValidationService;
import com.crdpls.api.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/kb/articles")
@CrossOrigin
public class KbArticleController {

    private final KbArticleService articleService;
    private final KbValidationService validationService;
    private final UserRepository userRepository;

    public KbArticleController(KbArticleService articleService, KbValidationService validationService, UserRepository userRepository) {
        this.articleService = articleService;
        this.validationService = validationService;
        this.userRepository = userRepository;
    }

    @GetMapping("/category/{categoryId}")
    public List<KbArticle> getArticlesByCategory(
            @PathVariable Long categoryId,
            @RequestParam(name = "includeInactive", defaultValue = "false") boolean includeInactive
    ) {
        return articleService.getArticlesByCategory(categoryId, includeInactive);
    }

    @GetMapping
    public List<KbArticle> getAllArticles() {
        return articleService.getAllArticles();
    }

    @GetMapping("/{id}")
    public KbArticle getArticle(@PathVariable Long id) {
        return articleService.getArticleById(id);
    }

    @PostMapping
    public KbArticle createArticle(Authentication authentication, @RequestBody KbArticleCreateRequestDto request) {
        return articleService.createArticle(request, requireUser(authentication));
    }

    @PutMapping("/{id}")
    public KbArticle updateArticle(Authentication authentication, @PathVariable Long id, @RequestBody KbArticleCreateRequestDto request) {
        return articleService.updateArticle(id, request, requireUser(authentication));
    }

    @GetMapping("/{id}/draft")
    public KbArticleDraftDto getDraft(Authentication authentication, @PathVariable Long id) {
        return validationService.getDraftForEditor(requireUser(authentication), id);
    }

    @PutMapping("/{id}/draft")
    public KbArticleDraftDto saveDraft(
            Authentication authentication,
            @PathVariable Long id,
            @RequestBody KbArticleDraftRequestDto request
    ) {
        return validationService.saveDraft(requireUser(authentication), id, request);
    }

    @PatchMapping("/{id}/active")
    public KbArticle setArticleActive(@PathVariable Long id, @RequestParam("value") boolean value) {
        return articleService.setArticleActive(id, value);
    }

    @PostMapping("/{id}/duplicate")
    public KbArticle duplicateArticle(Authentication authentication, @PathVariable Long id) {
        return articleService.duplicateArticle(id, requireUser(authentication));
    }

    @DeleteMapping("/{id}")
    public void deleteArticle(@PathVariable Long id) {
        articleService.deleteArticle(id);
    }

    private User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        User user = userRepository.findByEmail(authentication.getName());
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found");
        if (!Boolean.TRUE.equals(user.getActive())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is deactivated");
        return user;
    }
}
