package com.crdpls.api.service;

import com.crdpls.api.dto.StaffCreateUserRequest;
import com.crdpls.api.dto.StaffUserDto;
import com.crdpls.api.models.User;
import com.crdpls.api.models.UserStatus;
import com.crdpls.api.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class StaffService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PresenceTimelineService presenceTimelineService;

    public StaffService(
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        PresenceTimelineService presenceTimelineService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.presenceTimelineService = presenceTimelineService;
    }

    public List<StaffUserDto> listUsers() {
        return userRepository.findAll()
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public StaffUserDto createUser(StaffCreateUserRequest request) {
        if (request == null || isBlank(request.email()) || isBlank(request.password()) || isBlank(request.firstName()) || isBlank(request.lastName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing required fields");
        }
        if (userRepository.findByEmail(request.email()) != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        User user = new User();
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setDob(request.dob());
        user.setEmail(request.email().trim().toLowerCase());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(normalizeRole(request.role()));
        user.setActive(true);
        user.setStatus(UserStatus.OFFLINE);
        user.setDeactivationReason(null);
        user.setDeactivatedAt(null);
        User saved = userRepository.save(user);
        presenceTimelineService.record(saved, saved.getStatus(), "system", "SYSTEM", "User created");
        return toDto(saved);
    }

    @Transactional
    public StaffUserDto updateRole(Long userId, String role) {
        User user = getUser(userId);
        user.setRole(normalizeRole(role));
        return toDto(userRepository.save(user));
    }

    @Transactional
    public StaffUserDto updateStatus(Long userId, String status, String changedByEmail) {
        User user = getUser(userId);
        user.setStatus(normalizeStatus(status));
        User saved = userRepository.save(user);
        presenceTimelineService.record(saved, saved.getStatus(), changedByEmail, "STAFF", null);
        return toDto(saved);
    }

    @Transactional
    public StaffUserDto deactivate(Long userId, String reason, String changedByEmail) {
        User user = getUser(userId);
        user.setActive(false);
        user.setStatus(UserStatus.OFFLINE);
        user.setDeactivationReason(isBlank(reason) ? "Deactivated by admin" : reason.trim());
        user.setDeactivatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        presenceTimelineService.record(saved, saved.getStatus(), changedByEmail, "STAFF", "User deactivated");
        return toDto(saved);
    }

    @Transactional
    public StaffUserDto activate(Long userId, String changedByEmail) {
        User user = getUser(userId);
        user.setActive(true);
        user.setStatus(UserStatus.AWAY);
        user.setDeactivationReason(null);
        user.setDeactivatedAt(null);
        User saved = userRepository.save(user);
        presenceTimelineService.record(saved, saved.getStatus(), changedByEmail, "STAFF", "User activated");
        return toDto(saved);
    }

    @Transactional
    public StaffUserDto resetPassword(Long userId, String password) {
        if (isBlank(password)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is required");
        }
        User user = getUser(userId);
        user.setPassword(passwordEncoder.encode(password));
        return toDto(userRepository.save(user));
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private StaffUserDto toDto(User user) {
        return new StaffUserDto(
            user.getId(),
            user.getFirstName(),
            user.getLastName(),
            user.getDob(),
            user.getEmail(),
            user.getRole(),
            normalizeStatus(user.getStatus()),
            Boolean.TRUE.equals(user.getActive()),
            user.getDeactivationReason(),
            user.getDeactivatedAt()
        );
    }

    private String normalizeRole(String role) {
        if (isBlank(role)) {
            return "AGENT";
        }
        return role.trim().toUpperCase();
    }

    private String normalizeStatus(String status) {
        try {
            return UserStatus.normalize(status);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
