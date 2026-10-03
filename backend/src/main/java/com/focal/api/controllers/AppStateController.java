package com.focal.api.controllers;

import com.focal.api.dto.AppStateDto;
import com.focal.api.models.AppStateEntry;
import com.focal.api.models.User;
import com.focal.api.repository.AppStateEntryRepository;
import com.focal.api.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/state")
@CrossOrigin("*")
public class AppStateController {

    private static final Pattern SAFE_KEY = Pattern.compile("^[a-zA-Z0-9._:-]{1,96}$");

    private final AppStateEntryRepository appStateEntryRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public AppStateController(
        AppStateEntryRepository appStateEntryRepository,
        UserRepository userRepository
    ) {
        this.appStateEntryRepository = appStateEntryRepository;
        this.userRepository = userRepository;
        this.objectMapper = new ObjectMapper();
    }

    @GetMapping("/{key}")
    public AppStateDto getState(Authentication authentication, @PathVariable String key) {
        requireUser(authentication);
        String normalizedKey = normalizeKey(key);
        AppStateEntry entry = appStateEntryRepository.findById(normalizedKey)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "State key not found"));
        return toDto(entry);
    }

    @PutMapping("/{key}")
    public AppStateDto putState(
        Authentication authentication,
        @PathVariable String key,
        @RequestBody(required = false) JsonNode payload
    ) {
        User user = requireUser(authentication);
        String normalizedKey = normalizeKey(key);

        JsonNode valueNode = extractValue(payload);
        if (valueNode == null || valueNode.isMissingNode()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing state payload");
        }

        AppStateEntry entry = appStateEntryRepository.findById(normalizedKey).orElseGet(AppStateEntry::new);
        entry.setStateKey(normalizedKey);
        entry.setStateJson(stringify(valueNode));
        entry.setUpdatedByUserId(user.getId());
        entry.setUpdatedAt(LocalDateTime.now());

        AppStateEntry saved = appStateEntryRepository.save(entry);
        return toDto(saved);
    }

    private String normalizeKey(String rawKey) {
        String key = rawKey == null ? "" : rawKey.trim();
        if (!SAFE_KEY.matcher(key).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid state key");
        }
        return key;
    }

    private JsonNode extractValue(JsonNode payload) {
        if (payload == null || payload.isNull()) return NullNode.getInstance();
        if (payload.has("value")) return payload.get("value");
        return payload;
    }

    private String stringify(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid state payload");
        }
    }

    private JsonNode parse(String rawJson) {
        try {
            return objectMapper.readTree(rawJson == null ? "null" : rawJson);
        } catch (Exception ex) {
            return NullNode.getInstance();
        }
    }

    private AppStateDto toDto(AppStateEntry entry) {
        AppStateDto dto = new AppStateDto();
        dto.setKey(entry.getStateKey());
        dto.setValue(parse(entry.getStateJson()));
        dto.setUpdatedAt(entry.getUpdatedAt() == null ? null : entry.getUpdatedAt().toString());
        dto.setUpdatedByUserId(entry.getUpdatedByUserId());
        return dto;
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
}
