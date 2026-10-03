package com.focal.api.service;

import com.focal.api.dto.TrainingAssetMetaDto;
import com.focal.api.models.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class TrainingAssetService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Path assetsRootDir;

    @Value("${training.assets.max-bytes:262144000}")
    private long maxBytes;

    public TrainingAssetService(
        @Value("${training.assets.dir:./data/training-assets}") String assetsDir
    ) {
        this.assetsRootDir = Paths.get(assetsDir).toAbsolutePath().normalize();
    }

    public TrainingAssetMetaDto uploadVideo(MultipartFile file, User uploadedBy) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No file uploaded.");
        }
        if (file.getSize() > maxBytes) {
            throw new ResponseStatusException(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "Video exceeds max size (" + maxBytes + " bytes)."
            );
        }

        String mimeType = normalizeMimeType(file.getContentType());
        if (!mimeType.toLowerCase(Locale.ROOT).startsWith("video/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only video files are allowed.");
        }

        String id = UUID.randomUUID().toString();
        String storedFilename = id + ".bin";
        String createdAt = Instant.now().toString();
        String filename = normalizeFilename(file.getOriginalFilename());
        long sizeBytes;
        try {
            Files.createDirectories(assetsRootDir);
            Path targetPath = assetsRootDir.resolve(storedFilename).normalize();
            file.transferTo(targetPath.toFile());
            sizeBytes = Files.size(targetPath);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded file.");
        }

        StoredMeta storedMeta = new StoredMeta();
        storedMeta.id = id;
        storedMeta.kind = "VIDEO";
        storedMeta.filename = filename;
        storedMeta.mimeType = mimeType;
        storedMeta.size = sizeBytes;
        storedMeta.createdAt = createdAt;
        storedMeta.storedFilename = storedFilename;
        storedMeta.uploadedByUserId = uploadedBy == null ? null : uploadedBy.getId();
        writeStoredMeta(storedMeta);

        return toMetaDto(storedMeta);
    }

    public TrainingAssetMetaDto getMeta(String assetId) {
        StoredMeta storedMeta = readStoredMetaOrThrow(assetId);
        return toMetaDto(storedMeta);
    }

    public TrainingAssetPayload getVideo(String assetId) {
        StoredMeta storedMeta = readStoredMetaOrThrow(assetId);
        Path filePath = resolveAssetDataPath(storedMeta);
        if (!Files.exists(filePath)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Training asset file not found.");
        }
        return new TrainingAssetPayload(filePath, toMetaDto(storedMeta));
    }

    public void delete(String assetId) {
        String id = normalizeAssetId(assetId);
        if (id == null) return;

        Path metaPath = resolveMetaPath(id);
        StoredMeta meta = readStoredMeta(id);
        if (meta != null) {
            Path dataPath = resolveAssetDataPath(meta);
            try {
                Files.deleteIfExists(dataPath);
            } catch (IOException ignored) {
                // Best effort.
            }
        }
        try {
            Files.deleteIfExists(metaPath);
        } catch (IOException ignored) {
            // Best effort.
        }
    }

    private StoredMeta readStoredMetaOrThrow(String assetId) {
        String id = normalizeAssetId(assetId);
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid asset id.");
        }
        StoredMeta storedMeta = readStoredMeta(id);
        if (storedMeta == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Training asset not found.");
        }
        return storedMeta;
    }

    private StoredMeta readStoredMeta(String id) {
        try {
            Path path = resolveMetaPath(id);
            if (!Files.exists(path)) return null;
            return objectMapper.readValue(path.toFile(), StoredMeta.class);
        } catch (Exception ex) {
            return null;
        }
    }

    private void writeStoredMeta(StoredMeta storedMeta) {
        try {
            Files.createDirectories(assetsRootDir);
            objectMapper.writeValue(resolveMetaPath(storedMeta.id).toFile(), storedMeta);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store video metadata.");
        }
    }

    private Path resolveMetaPath(String id) {
        return assetsRootDir.resolve(id + ".json").normalize();
    }

    private Path resolveAssetDataPath(StoredMeta storedMeta) {
        String storedFilename = (storedMeta.storedFilename == null || storedMeta.storedFilename.isBlank())
            ? (storedMeta.id + ".bin")
            : storedMeta.storedFilename.trim();
        return assetsRootDir.resolve(storedFilename).normalize();
    }

    private TrainingAssetMetaDto toMetaDto(StoredMeta asset) {
        TrainingAssetMetaDto dto = new TrainingAssetMetaDto();
        dto.setId(asset.id);
        dto.setKind(asset.kind);
        dto.setFilename(asset.filename);
        dto.setMimeType(asset.mimeType);
        dto.setSize(asset.size);
        dto.setCreatedAt(asset.createdAt);
        return dto;
    }

    private String normalizeAssetId(String value) {
        if (value == null) return null;
        String id = value.trim();
        return id.isBlank() ? null : id;
    }

    private String normalizeMimeType(String value) {
        if (value == null || value.isBlank()) return "application/octet-stream";
        return value.trim();
    }

    private String normalizeFilename(String value) {
        if (value == null || value.isBlank()) return "video";
        String name = value.replace('\\', '_').replace('/', '_').trim();
        return name.isBlank() ? "video" : name;
    }

    public record TrainingAssetPayload(Path filePath, TrainingAssetMetaDto meta) {}

    private static class StoredMeta {
        public String id;
        public String kind;
        public String filename;
        public String mimeType;
        public Long size;
        public String createdAt;
        public String storedFilename;
        public Long uploadedByUserId;
    }
}
