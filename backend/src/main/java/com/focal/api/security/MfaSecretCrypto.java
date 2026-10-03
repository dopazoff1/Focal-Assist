package com.focal.api.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class MfaSecretCrypto {

    private static final String PREFIX = "v1";
    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public MfaSecretCrypto(
        @Value("${security.mfa.encryption-key:${security.jwt.secret:focal-change-this-secret-key-focal-change-this-secret}}") String encryptionKey
    ) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(encryptionKey.getBytes(StandardCharsets.UTF_8));
            this.key = new SecretKeySpec(digest, "AES");
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to initialize MFA encryption", ex);
        }
    }

    public String encrypt(String plainText) {
        if (plainText == null || plainText.isBlank()) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH, iv));
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            return PREFIX + ":"
                + Base64.getUrlEncoder().withoutPadding().encodeToString(iv) + ":"
                + Base64.getUrlEncoder().withoutPadding().encodeToString(encrypted);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to encrypt MFA secret", ex);
        }
    }

    public String decrypt(String encoded) {
        if (encoded == null || encoded.isBlank()) {
            return null;
        }
        try {
            String[] parts = encoded.split(":", 3);
            if (parts.length != 3 || !PREFIX.equals(parts[0])) {
                throw new IllegalArgumentException("Unsupported MFA secret format");
            }
            byte[] iv = Base64.getUrlDecoder().decode(parts[1]);
            byte[] encrypted = Base64.getUrlDecoder().decode(parts[2]);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to decrypt MFA secret", ex);
        }
    }
}
