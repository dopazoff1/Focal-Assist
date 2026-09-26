package com.crdpls.api.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Objects;

@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationSeconds;
    private final long attachmentExpirationSeconds;

    public JwtService(
        @Value("${security.jwt.secret:creditplus-change-this-secret-key-creditplus-change-this-secret}") String secret,
        @Value("${security.jwt.expiration-seconds:43200}") long expirationSeconds,
        @Value("${security.jwt.attachment-expiration-seconds:600}") long attachmentExpirationSeconds
    ) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationSeconds = expirationSeconds;
        this.attachmentExpirationSeconds = attachmentExpirationSeconds;
    }

    public String generateToken(String username) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(username)
            .claim("typ", "access")
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(expirationSeconds)))
            .signWith(signingKey)
            .compact();
    }

    public String generateMfaToken(Long userId, String email, String purpose, long tokenExpirationSeconds) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(email)
            .claim("typ", purpose)
            .claim("uid", userId)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(tokenExpirationSeconds)))
            .signWith(signingKey)
            .compact();
    }

    public String extractUsername(String token) {
        return extractClaims(token).getSubject();
    }

    public boolean isTokenValid(String token, String expectedUsername) {
        Claims claims = extractClaims(token);
        String tokenType = claims.get("typ", String.class);
        return (tokenType == null || "access".equals(tokenType))
            && expectedUsername.equalsIgnoreCase(claims.getSubject())
            && claims.getExpiration() != null
            && claims.getExpiration().after(new Date());
    }

    public MfaTokenClaims validateMfaToken(String token, String expectedPurpose) {
        if (token == null || token.isBlank() || expectedPurpose == null || expectedPurpose.isBlank()) {
            return null;
        }
        try {
            Claims claims = extractClaims(token);
            String purpose = claims.get("typ", String.class);
            String email = claims.getSubject();
            Object userId = claims.get("uid");
            Date expiration = claims.getExpiration();
            if (!expectedPurpose.equals(purpose) || email == null || expiration == null || expiration.before(new Date())) {
                return null;
            }
            long id = userId instanceof Number number ? number.longValue() : Long.parseLong(String.valueOf(userId));
            return new MfaTokenClaims(id, email, purpose);
        } catch (Exception ignored) {
            return null;
        }
    }

    public record MfaTokenClaims(Long userId, String email, String purpose) {}

    public String generateAttachmentToken(Long userId, String messageId, String attachmentId) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject("gmail-attachment")
            .claim("typ", "gmail_attachment")
            .claim("uid", userId)
            .claim("mid", messageId == null ? "" : messageId)
            .claim("aid", attachmentId == null ? "" : attachmentId)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(attachmentExpirationSeconds)))
            .signWith(signingKey)
            .compact();
    }

    public boolean isAttachmentTokenValid(String token, Long userId, String messageId, String attachmentId) {
        if (token == null || token.isBlank() || userId == null) {
            return false;
        }
        try {
            Claims claims = extractClaims(token);
            if (!"gmail_attachment".equals(claims.get("typ", String.class))) {
                return false;
            }
            Object uidRaw = claims.get("uid");
            long uid = uidRaw instanceof Number ? ((Number) uidRaw).longValue() : -1L;
            String mid = claims.get("mid", String.class);
            String aid = claims.get("aid", String.class);
            Date exp = claims.getExpiration();
            if (exp == null || exp.before(new Date())) {
                return false;
            }
            return uid == userId
                && Objects.equals(mid, messageId == null ? "" : messageId)
                && Objects.equals(aid, attachmentId == null ? "" : attachmentId);
        } catch (Exception ignored) {
            return false;
        }
    }

    private Claims extractClaims(String token) {
        return Jwts.parser()
            .verifyWith(signingKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
