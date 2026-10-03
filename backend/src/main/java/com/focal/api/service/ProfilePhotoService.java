package com.focal.api.service;

import com.focal.api.models.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Iterator;

@Service
public class ProfilePhotoService {

    public static final int ORIGINAL_SIZE = 1024;
    public static final int LIGHT_SIZE = 256;
    private static final long MAX_UPLOAD_BYTES = 20L * 1024L * 1024L;

    public void saveProfilePhoto(User user, MultipartFile file) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid user.");
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No photo uploaded.");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Profile photo exceeds 20MB.");
        }

        BufferedImage decoded = readImage(file);
        BufferedImage square = cropToCenterSquare(decoded);
        BufferedImage original = resizeSquare(square, ORIGINAL_SIZE);
        BufferedImage light = resizeSquare(square, LIGHT_SIZE);

        user.setProfilePhotoOriginal(encodeJpeg(original, 0.92f));
        user.setProfilePhotoLight(encodeJpeg(light, 0.78f));
        user.setProfilePhotoContentType("image/jpeg");
        user.setProfilePhotoUpdatedAt(LocalDateTime.now());
    }

    public void clearProfilePhoto(User user) {
        if (user == null) return;
        user.setProfilePhotoOriginal(null);
        user.setProfilePhotoLight(null);
        user.setProfilePhotoContentType(null);
        user.setProfilePhotoUpdatedAt(null);
    }

    public byte[] resolvePhoto(User user, boolean originalSize) {
        if (user == null) return null;
        return originalSize ? user.getProfilePhotoOriginal() : user.getProfilePhotoLight();
    }

    public boolean hasPhoto(User user) {
        return user != null
            && user.getProfilePhotoLight() != null
            && user.getProfilePhotoLight().length > 0;
    }

    private BufferedImage readImage(MultipartFile file) {
        try (ByteArrayInputStream input = new ByteArrayInputStream(file.getBytes())) {
            BufferedImage image = ImageIO.read(input);
            if (image == null || image.getWidth() <= 0 || image.getHeight() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported image format.");
            }
            return toRgb(image);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded image.");
        }
    }

    private BufferedImage toRgb(BufferedImage source) {
        if (source.getType() == BufferedImage.TYPE_INT_RGB) {
            return source;
        }
        BufferedImage rgb = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = rgb.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, rgb.getWidth(), rgb.getHeight());
            graphics.drawImage(source, 0, 0, null);
        } finally {
            graphics.dispose();
        }
        return rgb;
    }

    private BufferedImage cropToCenterSquare(BufferedImage source) {
        int size = Math.min(source.getWidth(), source.getHeight());
        int x = (source.getWidth() - size) / 2;
        int y = (source.getHeight() - size) / 2;

        BufferedImage cropped = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = cropped.createGraphics();
        try {
            graphics.drawImage(
                source,
                0,
                0,
                size,
                size,
                x,
                y,
                x + size,
                y + size,
                null
            );
        } finally {
            graphics.dispose();
        }
        return cropped;
    }

    private BufferedImage resizeSquare(BufferedImage source, int targetSize) {
        BufferedImage output = new BufferedImage(targetSize, targetSize, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = output.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(source, 0, 0, targetSize, targetSize, null);
        } finally {
            graphics.dispose();
        }
        return output;
    }

    private byte[] encodeJpeg(BufferedImage source, float quality) {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "JPEG encoder is unavailable.");
        }
        ImageWriter writer = writers.next();

        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             ImageOutputStream imageOut = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(imageOut);
            ImageWriteParam params = writer.getDefaultWriteParam();
            if (params.canWriteCompressed()) {
                params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                params.setCompressionQuality(Math.max(0.1f, Math.min(1f, quality)));
            }
            writer.write(null, new IIOImage(source, null, null), params);
            writer.dispose();
            return out.toByteArray();
        } catch (IOException ex) {
            writer.dispose();
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not encode profile photo.");
        }
    }
}
