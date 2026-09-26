package com.crdpls.api.controllers;

import com.crdpls.api.dto.KbMapResponseDto;
import com.crdpls.api.dto.KbMapSaveRequestDto;
import com.crdpls.api.models.User;
import com.crdpls.api.repository.UserRepository;
import com.crdpls.api.service.KbMapService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/kb-map")
@CrossOrigin
public class KbMapController {

    private final KbMapService kbMapService;
    private final UserRepository userRepository;

    public KbMapController(KbMapService kbMapService, UserRepository userRepository) {
        this.kbMapService = kbMapService;
        this.userRepository = userRepository;
    }

    @GetMapping({
            "/article/{articleId}",
            "/articles/{articleId}",
            "/{articleId}"
    })
    public KbMapResponseDto getArticleMap(@PathVariable Long articleId) {
        return kbMapService.getArticleMap(articleId);
    }

    @RequestMapping(
            path = {
                    "/article/{articleId}/save",
                    "/articles/{articleId}/save",
                    "/{articleId}/save",
                    "/article/{articleId}"
            },
            method = {RequestMethod.POST, RequestMethod.PUT}
    )
    public Map<String, Object> saveArticleMap(
            Authentication authentication,
            @PathVariable Long articleId,
            @RequestBody KbMapSaveRequestDto request
    ) {
        return kbMapService.saveArticleMap(articleId, request, requireUser(authentication));
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
