package com.crdpls.api.controllers;

import com.crdpls.api.models.User;
import com.crdpls.api.models.UserStatus;
import com.crdpls.api.repository.UserRepository;
import com.crdpls.api.security.JwtService;
import com.crdpls.api.security.MfaService;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@CrossOrigin("*")
public class AuthController {

    private static final long MFA_SETUP_TOKEN_SECONDS = 600;
    private static final long MFA_CHALLENGE_TOKEN_SECONDS = 300;

    private final UserRepository userRepository;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final MfaService mfaService;

    public AuthController(
        UserRepository userRepository,
        AuthenticationManager authenticationManager,
        JwtService jwtService,
        MfaService mfaService
    ) {
        this.userRepository = userRepository;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.mfaService = mfaService;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginRequest request) {
        if (request == null || request.email() == null || request.password() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required");
        }

        User user = userRepository.findByEmail(request.email());
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        ensureActive(user);

        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
            );
        } catch (AuthenticationException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        if (!Boolean.TRUE.equals(user.getMfaEnabled())) {
            return Map.of(
                "mfaSetupRequired", true,
                "setupToken", jwtService.generateMfaToken(user.getId(), user.getEmail(), "mfa_setup", MFA_SETUP_TOKEN_SECONDS)
            );
        }

        return Map.of(
            "mfaRequired", true,
            "challengeToken", jwtService.generateMfaToken(user.getId(), user.getEmail(), "mfa_challenge", MFA_CHALLENGE_TOKEN_SECONDS)
        );
    }

    @PostMapping("/mfa/setup/start")
    public Map<String, Object> startMfaSetup(@RequestBody MfaTokenRequest request) {
        JwtService.MfaTokenClaims claims = requireMfaToken(request == null ? null : request.token(), "mfa_setup");
        User user = requireUser(claims);
        if (Boolean.TRUE.equals(user.getMfaEnabled())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Authenticator is already configured");
        }

        MfaService.SetupDetails setup = mfaService.startSetup(user);
        return Map.of(
            "account", setup.account(),
            "issuer", setup.issuer(),
            "secret", setup.secret(),
            "otpauthUrl", setup.otpAuthUrl(),
            "qrCodeDataUrl", setup.qrCodeDataUrl(),
            "expiresAt", user.getMfaPendingExpiresAt().toString()
        );
    }

    @PostMapping("/mfa/setup/confirm")
    public Map<String, Object> confirmMfaSetup(@RequestBody MfaConfirmRequest request) {
        JwtService.MfaTokenClaims claims = requireMfaToken(request == null ? null : request.token(), "mfa_setup");
        User user = requireUser(claims);
        try {
            List<String> backupCodes = mfaService.confirmSetup(user, request.code());
            Map<String, Object> response = userResponse(user, jwtService.generateToken(user.getEmail()));
            response.put("mfaConfigured", true);
            response.put("backupCodes", backupCodes);
            return response;
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @PostMapping("/mfa/verify")
    public Map<String, Object> verifyMfa(@RequestBody MfaVerifyRequest request) {
        JwtService.MfaTokenClaims claims = requireMfaToken(request == null ? null : request.token(), "mfa_challenge");
        User user = requireUser(claims);
        boolean validTotp = mfaService.verifyTotpForUser(user, request.code());
        boolean validBackup = !validTotp && mfaService.consumeBackupCode(user, request.backupCode());
        if (!validTotp && !validBackup) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "That security code is not valid");
        }
        return userResponse(user, jwtService.generateToken(user.getEmail()));
    }

    private JwtService.MfaTokenClaims requireMfaToken(String token, String purpose) {
        JwtService.MfaTokenClaims claims = jwtService.validateMfaToken(token, purpose);
        if (claims == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "This authentication step has expired");
        }
        return claims;
    }

    private User requireUser(JwtService.MfaTokenClaims claims) {
        User user = userRepository.findById(claims.userId()).orElse(null);
        if (user == null || !claims.email().equalsIgnoreCase(user.getEmail())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "This authentication step is not valid");
        }
        ensureActive(user);
        return user;
    }

    private void ensureActive(User user) {
        if (Boolean.FALSE.equals(user.getActive())) {
            boolean explicitlyDeactivated = user.getDeactivatedAt() != null
                || (user.getDeactivationReason() != null && !user.getDeactivationReason().isBlank());
            if (explicitlyDeactivated) {
                long activeUsers = userRepository.countByActiveTrue();
                if (activeUsers > 0) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is deactivated");
                }
                user.setActive(true);
                user.setDeactivationReason(null);
                user.setDeactivatedAt(null);
                userRepository.save(user);
            } else {
                user.setActive(true);
                userRepository.save(user);
            }
        }
    }

    private Map<String, Object> userResponse(User user, String token) {
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("id", user.getId());
        response.put("firstName", user.getFirstName());
        response.put("lastName", user.getLastName());
        response.put("email", user.getEmail());
        response.put("dob", user.getDob());
        response.put("role", user.getRole());
        response.put("status", UserStatus.normalize(user.getStatus()));
        response.put("timeZone", user.getTimeZone() == null ? "" : user.getTimeZone());
        response.put("uiLanguage", user.getUiLanguage() == null ? "en" : user.getUiLanguage());
        response.put("desktopNotificationsEnabled", user.getDesktopNotificationsEnabled() == null || user.getDesktopNotificationsEnabled());
        response.put("soundNotificationsEnabled", user.getSoundNotificationsEnabled() == null || user.getSoundNotificationsEnabled());
        response.put("hasProfilePhoto", user.getProfilePhotoLight() != null && user.getProfilePhotoLight().length > 0);
        response.put(
            "profilePhotoUpdatedAt",
            user.getProfilePhotoUpdatedAt() == null
                ? ""
                : user.getProfilePhotoUpdatedAt().atZone(ZoneId.systemDefault()).toInstant().toString()
        );
        return response;
    }

    public record LoginRequest(String email, String password) {}
    public record MfaTokenRequest(String token) {}
    public record MfaConfirmRequest(String token, String code) {}
    public record MfaVerifyRequest(String token, String code, String backupCode) {}
}
