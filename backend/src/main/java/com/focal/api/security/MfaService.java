package com.focal.api.security;

import com.focal.api.models.User;
import com.focal.api.repository.UserRepository;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@Service
public class MfaService {

    private static final String ISSUER = "Focal";
    private static final String BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final String BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int WINDOW = 1;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final MfaSecretCrypto secretCrypto;
    private final SecureRandom random = new SecureRandom();

    public MfaService(UserRepository userRepository, PasswordEncoder passwordEncoder, MfaSecretCrypto secretCrypto) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.secretCrypto = secretCrypto;
    }

    public SetupDetails startSetup(User user) {
        String secret = generateSecret();
        user.setMfaPendingSecretEncrypted(secretCrypto.encrypt(secret));
        user.setMfaPendingExpiresAt(LocalDateTime.now().plusMinutes(10));
        userRepository.save(user);

        String account = user.getEmail().trim();
        String otpAuthUrl = "otpauth://totp/" + encode(ISSUER) + ":" + encode(account)
            + "?secret=" + secret
            + "&issuer=" + encode(ISSUER)
            + "&algorithm=SHA1&digits=6&period=30";
        return new SetupDetails(account, ISSUER, secret, otpAuthUrl, renderQrCode(otpAuthUrl));
    }

    @Transactional
    public List<String> confirmSetup(User user, String code) {
        if (user.getMfaPendingExpiresAt() == null || user.getMfaPendingExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("MFA setup has expired. Start again.");
        }
        String secret = secretCrypto.decrypt(user.getMfaPendingSecretEncrypted());
        if (secret == null || !verifyTotp(secret, code)) {
            throw new IllegalArgumentException("That authenticator code is not valid.");
        }

        List<String> backupCodes = generateBackupCodes();
        user.setMfaSecretEncrypted(secretCrypto.encrypt(secret));
        user.setMfaEnabled(true);
        user.setMfaPendingSecretEncrypted(null);
        user.setMfaPendingExpiresAt(null);
        user.setMfaBackupCodes(String.join("\n", backupCodes.stream().map(passwordEncoder::encode).toList()));
        userRepository.save(user);
        return backupCodes;
    }

    public boolean verifyTotpForUser(User user, String code) {
        if (!Boolean.TRUE.equals(user.getMfaEnabled())) {
            return false;
        }
        String secret = secretCrypto.decrypt(user.getMfaSecretEncrypted());
        return secret != null && verifyTotp(secret, code);
    }

    @Transactional
    public boolean consumeBackupCode(User user, String input) {
        String normalized = normalizeBackupCode(input);
        if (normalized.isBlank() || user.getMfaBackupCodes() == null || user.getMfaBackupCodes().isBlank()) {
            return false;
        }

        String[] stored = user.getMfaBackupCodes().split("\\R");
        List<String> remaining = new ArrayList<>();
        boolean matched = false;
        for (String hash : stored) {
            if (!matched && passwordEncoder.matches(normalized, hash)) {
                matched = true;
            } else if (!hash.isBlank()) {
                remaining.add(hash);
            }
        }
        if (matched) {
            user.setMfaBackupCodes(String.join("\n", remaining));
            userRepository.save(user);
        }
        return matched;
    }

    private boolean verifyTotp(String secret, String input) {
        String code = input == null ? "" : input.replaceAll("\\s", "");
        if (!code.matches("\\d{6}")) {
            return false;
        }
        long currentStep = System.currentTimeMillis() / 1000L / 30L;
        for (long offset = -WINDOW; offset <= WINDOW; offset++) {
            String expected = generateCode(secret, currentStep + offset);
            if (MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), code.getBytes(StandardCharsets.US_ASCII))) {
                return true;
            }
        }
        return false;
    }

    private String generateCode(String secret, long counter) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(decodeBase32(secret), "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(counter).array());
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24)
                | ((hash[offset + 1] & 0xff) << 16)
                | ((hash[offset + 2] & 0xff) << 8)
                | (hash[offset + 3] & 0xff);
            return String.format("%06d", binary % 1_000_000);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to verify authenticator code", ex);
        }
    }

    private List<String> generateBackupCodes() {
        List<String> codes = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            StringBuilder raw = new StringBuilder(8);
            for (int j = 0; j < 8; j++) {
                raw.append(BACKUP_ALPHABET.charAt(random.nextInt(BACKUP_ALPHABET.length())));
            }
            codes.add(raw.substring(0, 4) + "-" + raw.substring(4));
        }
        return codes;
    }

    private String normalizeBackupCode(String input) {
        return input == null ? "" : input.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
    }

    private String generateSecret() {
        byte[] bytes = new byte[20];
        random.nextBytes(bytes);
        return encodeBase32(bytes);
    }

    private String encodeBase32(byte[] bytes) {
        StringBuilder result = new StringBuilder((bytes.length * 8 + 4) / 5);
        int buffer = 0;
        int bits = 0;
        for (byte value : bytes) {
            buffer = (buffer << 8) | (value & 0xff);
            bits += 8;
            while (bits >= 5) {
                bits -= 5;
                result.append(BASE32_ALPHABET.charAt((buffer >> bits) & 0x1f));
            }
        }
        if (bits > 0) {
            result.append(BASE32_ALPHABET.charAt((buffer << (5 - bits)) & 0x1f));
        }
        return result.toString();
    }

    private byte[] decodeBase32(String input) {
        String normalized = input.replace("=", "").replaceAll("\\s", "").toUpperCase();
        ByteArrayOutputStream result = new ByteArrayOutputStream();
        int buffer = 0;
        int bits = 0;
        for (char value : normalized.toCharArray()) {
            int digit = BASE32_ALPHABET.indexOf(value);
            if (digit < 0) throw new IllegalArgumentException("Invalid MFA secret");
            buffer = (buffer << 5) | digit;
            bits += 5;
            if (bits >= 8) {
                bits -= 8;
                result.write((buffer >> bits) & 0xff);
            }
        }
        return result.toByteArray();
    }

    private String renderQrCode(String value) {
        try {
            BitMatrix matrix = new QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 260, 260);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", output);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
        } catch (WriterException | java.io.IOException ex) {
            throw new IllegalStateException("Unable to create MFA QR code", ex);
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    public record SetupDetails(String account, String issuer, String secret, String otpAuthUrl, String qrCodeDataUrl) {}
}
