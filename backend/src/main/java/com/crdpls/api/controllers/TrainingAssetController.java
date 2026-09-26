package com.crdpls.api.controllers;

import com.crdpls.api.dto.TrainingAssetMetaDto;
import com.crdpls.api.models.User;
import com.crdpls.api.repository.UserRepository;
import com.crdpls.api.service.TrainingAssetService;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.net.MalformedURLException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Map;

@RestController
@RequestMapping("/api/training-assets")
@CrossOrigin
public class TrainingAssetController {

    private final TrainingAssetService trainingAssetService;
    private final UserRepository userRepository;

    public TrainingAssetController(TrainingAssetService trainingAssetService, UserRepository userRepository) {
        this.trainingAssetService = trainingAssetService;
        this.userRepository = userRepository;
    }

    @PostMapping(value = "/videos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TrainingAssetMetaDto uploadVideo(
        Authentication authentication,
        @RequestPart("file") MultipartFile file
    ) {
        User user = requireUser(authentication);
        return trainingAssetService.uploadVideo(file, user);
    }

    @GetMapping("/videos/{assetId}/meta")
    public TrainingAssetMetaDto getVideoMeta(Authentication authentication, @PathVariable String assetId) {
        requireUser(authentication);
        return trainingAssetService.getMeta(assetId);
    }

    @GetMapping("/videos/{assetId}")
    public ResponseEntity<Resource> getVideo(Authentication authentication, @PathVariable String assetId) {
        requireUser(authentication);
        TrainingAssetService.TrainingAssetPayload payload = trainingAssetService.getVideo(assetId);
        Resource resource;
        try {
            resource = new UrlResource(payload.filePath().toUri());
        } catch (MalformedURLException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Invalid video resource path.");
        }

        MediaType mediaType = parseMediaType(payload.meta().getMimeType());
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(mediaType);
        try {
            headers.setContentLength(Files.size(payload.filePath()));
        } catch (Exception ignored) {
            if (payload.meta().getSize() != null) {
                headers.setContentLength(payload.meta().getSize());
            }
        }
        headers.setContentDisposition(ContentDisposition.inline().filename(payload.meta().getFilename(), StandardCharsets.UTF_8).build());
        headers.setCacheControl(CacheControl.noCache().mustRevalidate());

        return new ResponseEntity<>(resource, headers, HttpStatus.OK);
    }

    @DeleteMapping("/videos/{assetId}")
    public Map<String, Object> deleteVideo(Authentication authentication, @PathVariable String assetId) {
        requireUser(authentication);
        trainingAssetService.delete(assetId);
        return Map.of("success", true);
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

    private MediaType parseMediaType(String raw) {
        if (raw == null || raw.isBlank()) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
        try {
            return MediaType.parseMediaType(raw);
        } catch (Exception ignored) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }
}
