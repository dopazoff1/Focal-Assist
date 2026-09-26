package com.crdpls.api.controllers;

import com.crdpls.api.dto.*;
import com.crdpls.api.models.User;
import com.crdpls.api.repository.UserRepository;
import com.crdpls.api.service.KbValidationService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/kb/validation")
@CrossOrigin
public class KbValidationController {
    private final KbValidationService validationService;
    private final UserRepository userRepository;

    public KbValidationController(KbValidationService validationService, UserRepository userRepository) {
        this.validationService = validationService;
        this.userRepository = userRepository;
    }

    @GetMapping("/eligible-users")
    public List<KbValidationUserDto> eligibleUsers(Authentication authentication) {
        return validationService.eligibleUsers(requireUser(authentication));
    }

    @GetMapping("/chain")
    public List<KbValidationStepDto> chain(Authentication authentication) {
        return validationService.getGlobalChain(requireUser(authentication));
    }

    @PutMapping("/chain")
    public List<KbValidationStepDto> saveChain(
            Authentication authentication,
            @RequestBody KbValidationChainRequestDto request
    ) {
        return validationService.saveGlobalChain(requireUser(authentication), request);
    }

    @GetMapping("/queue")
    public List<KbValidationQueueItemDto> queue(Authentication authentication) {
        return validationService.queue(requireUser(authentication));
    }

    @GetMapping("/revisions/{revisionId}")
    public KbArticleDraftDto detail(Authentication authentication, @PathVariable Long revisionId) {
        return validationService.detail(requireUser(authentication), revisionId);
    }

    @PostMapping("/revisions/{revisionId}/submit")
    public KbArticleDraftDto submit(Authentication authentication, @PathVariable Long revisionId) {
        return validationService.submit(requireUser(authentication), revisionId);
    }

    @PostMapping("/revisions/{revisionId}/comment")
    public KbArticleDraftDto comment(
            Authentication authentication,
            @PathVariable Long revisionId,
            @RequestBody KbValidationCommentRequestDto request
    ) {
        return validationService.addComment(requireUser(authentication), revisionId, request);
    }

    @PostMapping("/revisions/{revisionId}/approve")
    public KbArticleDraftDto approve(Authentication authentication, @PathVariable Long revisionId) {
        return validationService.approve(requireUser(authentication), revisionId);
    }

    @PostMapping("/revisions/{revisionId}/reject")
    public KbArticleDraftDto reject(
            Authentication authentication,
            @PathVariable Long revisionId,
            @RequestBody KbValidationCommentRequestDto request
    ) {
        return validationService.reject(requireUser(authentication), revisionId, request);
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
