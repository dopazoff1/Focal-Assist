package com.crdpls.api.controllers;

import com.crdpls.api.models.User;
import com.crdpls.api.repository.UserRepository;
import com.crdpls.api.service.ProfilePhotoService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
@CrossOrigin("*")
public class UserSettingsController {

    private final UserRepository userRepository;
    private final ProfilePhotoService profilePhotoService;
    private final PasswordEncoder passwordEncoder;

    public UserSettingsController(
        UserRepository userRepository,
        ProfilePhotoService profilePhotoService,
        PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.profilePhotoService = profilePhotoService;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/me")
    public Map<String, Object> getMeSettings() {
        User me = getCurrentUserOrThrow();
        return buildSettingsResponse(me);
    }

    @PutMapping("/me/timezone")
    public Map<String, Object> updateMyTimezone(@RequestBody Map<String, String> payload) {
        User me = getCurrentUserOrThrow();
        String tz = payload == null ? "" : (payload.getOrDefault("timeZone", ""));
        tz = tz == null ? "" : tz.trim();
        if (tz.length() > 64) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "timeZone is too long");
        }
        // Empty means "system default".
        me.setTimeZone(tz.isBlank() ? null : tz);
        userRepository.save(me);

        Map<String, Object> response = new LinkedHashMap<>(buildSettingsResponse(me));
        response.put("saved", true);
        return response;
    }

    @PutMapping("/me/preferences")
    public Map<String, Object> updateMyPreferences(@RequestBody Map<String, Object> payload) {
        User me = getCurrentUserOrThrow();

        String firstName = trimToNull(stringValue(payload, "firstName"));
        String lastName = trimToNull(stringValue(payload, "lastName"));
        String uiLanguage = normalizeLanguage(stringValue(payload, "uiLanguage"));
        boolean desktopNotificationsEnabled = booleanValue(payload, "desktopNotificationsEnabled", true);
        boolean soundNotificationsEnabled = booleanValue(payload, "soundNotificationsEnabled", true);

        if (firstName == null || firstName.length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "firstName is required and must be <= 80 chars");
        }
        if (lastName == null || lastName.length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "lastName is required and must be <= 80 chars");
        }

        me.setFirstName(firstName);
        me.setLastName(lastName);
        me.setUiLanguage(uiLanguage);
        me.setDesktopNotificationsEnabled(desktopNotificationsEnabled);
        me.setSoundNotificationsEnabled(soundNotificationsEnabled);
        userRepository.save(me);

        Map<String, Object> response = new LinkedHashMap<>(buildSettingsResponse(me));
        response.put("saved", true);
        return response;
    }

    @PutMapping("/me/password")
    public Map<String, Object> updateMyPassword(@RequestBody Map<String, String> payload) {
        User me = getCurrentUserOrThrow();
        String currentPassword = payload == null ? null : payload.get("currentPassword");
        String newPassword = payload == null ? null : payload.get("newPassword");
        if (currentPassword == null || currentPassword.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "currentPassword is required");
        }
        if (newPassword == null || newPassword.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "newPassword is required");
        }
        if (newPassword.length() < 4 || newPassword.length() > 128) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "newPassword must be between 4 and 128 chars");
        }
        if (!passwordEncoder.matches(currentPassword, me.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }

        me.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(me);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("saved", true);
        return response;
    }

    @GetMapping("/me/jira")
    public Map<String, Object> getMyJiraSettings() {
        User me = getCurrentUserOrThrow();
        return buildJiraSettingsResponse(me);
    }

    @PutMapping("/me/jira")
    public Map<String, Object> updateMyJiraSettings(@RequestBody Map<String, String> payload) {
        User me = getCurrentUserOrThrow();
        String baseUrl = trimToNull(payload == null ? null : payload.get("baseUrl"));
        String username = trimToNull(payload == null ? null : payload.get("username"));
        String password = trimToNull(payload == null ? null : payload.get("password"));
        String projectKey = trimToNull(payload == null ? null : payload.get("projectKey"));
        String issueTypeName = trimToNull(payload == null ? null : payload.get("issueTypeName"));

        if (baseUrl != null && baseUrl.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "baseUrl is too long");
        }
        if (username != null && username.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "username is too long");
        }
        if (password != null && password.length() > 512) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "password is too long");
        }
        if (projectKey != null && projectKey.length() > 64) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "projectKey is too long");
        }
        if (issueTypeName != null && issueTypeName.length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "issueTypeName is too long");
        }

        me.setJiraBaseUrl(baseUrl);
        me.setJiraUsername(username);
        me.setJiraPassword(password);
        me.setJiraProjectKey(projectKey == null ? null : projectKey.toUpperCase());
        me.setJiraIssueTypeName(issueTypeName == null ? null : issueTypeName.trim());
        userRepository.save(me);

        Map<String, Object> response = new LinkedHashMap<>(buildJiraSettingsResponse(me));
        response.put("saved", true);
        return response;
    }

    @PostMapping(value = "/me/profile-photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> uploadMyProfilePhoto(@RequestParam("file") MultipartFile file) {
        User me = getCurrentUserOrThrow();
        profilePhotoService.saveProfilePhoto(me, file);
        userRepository.save(me);

        Map<String, Object> response = new LinkedHashMap<>(buildSettingsResponse(me));
        response.put("saved", true);
        return response;
    }

    @DeleteMapping("/me/profile-photo")
    public Map<String, Object> deleteMyProfilePhoto() {
        User me = getCurrentUserOrThrow();
        profilePhotoService.clearProfilePhoto(me);
        userRepository.save(me);

        Map<String, Object> response = new LinkedHashMap<>(buildSettingsResponse(me));
        response.put("saved", true);
        return response;
    }

    @GetMapping("/me/profile-photo")
    public ResponseEntity<byte[]> getMyProfilePhoto(
        @RequestParam(name = "size", defaultValue = "light") String size
    ) {
        User me = getCurrentUserOrThrow();
        return toImageResponse(me, size);
    }

    @GetMapping("/users/{userId}/profile-photo")
    public ResponseEntity<byte[]> getUserProfilePhoto(
        @PathVariable Long userId,
        @RequestParam(name = "size", defaultValue = "light") String size
    ) {
        getCurrentUserOrThrow();
        User target = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (!Boolean.TRUE.equals(target.getActive())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        return toImageResponse(target, size);
    }

    private User getCurrentUserOrThrow() {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        User user = userRepository.findByEmail(auth.getName());
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is deactivated");
        }
        return user;
    }

    private ResponseEntity<byte[]> toImageResponse(User user, String size) {
        boolean original = "original".equalsIgnoreCase(size);
        byte[] bytes = profilePhotoService.resolvePhoto(user, original);
        if (bytes == null || bytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile photo not found");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.IMAGE_JPEG);
        headers.setContentLength(bytes.length);
        headers.setCacheControl(CacheControl.noCache().cachePrivate().mustRevalidate());

        return ResponseEntity.ok()
            .headers(headers)
            .body(bytes);
    }

    private Map<String, Object> buildSettingsResponse(User me) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("firstName", me.getFirstName() == null ? "" : me.getFirstName());
        response.put("lastName", me.getLastName() == null ? "" : me.getLastName());
        response.put("email", me.getEmail() == null ? "" : me.getEmail());
        response.put("role", me.getRole() == null ? "" : me.getRole());
        response.put("timeZone", me.getTimeZone() == null ? "" : me.getTimeZone());
        response.put("uiLanguage", normalizeLanguage(me.getUiLanguage()));
        response.put("desktopNotificationsEnabled", me.getDesktopNotificationsEnabled() == null || me.getDesktopNotificationsEnabled());
        response.put("soundNotificationsEnabled", me.getSoundNotificationsEnabled() == null || me.getSoundNotificationsEnabled());
        response.put("hasProfilePhoto", profilePhotoService.hasPhoto(me));
        response.put(
            "profilePhotoUpdatedAt",
            me.getProfilePhotoUpdatedAt() == null
                ? ""
                : me.getProfilePhotoUpdatedAt().atZone(ZoneId.systemDefault()).toInstant().toString()
        );
        return response;
    }

    private Map<String, Object> buildJiraSettingsResponse(User me) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("baseUrl", me.getJiraBaseUrl() == null ? "" : me.getJiraBaseUrl());
        response.put("username", me.getJiraUsername() == null ? "" : me.getJiraUsername());
        response.put("password", me.getJiraPassword() == null ? "" : me.getJiraPassword());
        response.put("projectKey", me.getJiraProjectKey() == null ? "" : me.getJiraProjectKey());
        response.put("issueTypeName", me.getJiraIssueTypeName() == null ? "Task" : me.getJiraIssueTypeName());
        return response;
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private String stringValue(Map<String, Object> payload, String key) {
        if (payload == null || key == null) return null;
        Object value = payload.get(key);
        return value == null ? null : value.toString();
    }

    private boolean booleanValue(Map<String, Object> payload, String key, boolean fallback) {
        if (payload == null || key == null) return fallback;
        Object value = payload.get(key);
        if (value == null) return fallback;
        if (value instanceof Boolean b) return b;
        String raw = value.toString().trim().toLowerCase();
        if ("true".equals(raw) || "1".equals(raw) || "yes".equals(raw)) return true;
        if ("false".equals(raw) || "0".equals(raw) || "no".equals(raw)) return false;
        return fallback;
    }

    private String normalizeLanguage(String raw) {
        String value = raw == null ? "" : raw.trim().toLowerCase();
        if ("fr".equals(value)) return "fr";
        return "en";
    }
}
