package com.focal.api.config;

import com.focal.api.models.User;
import com.focal.api.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class LoginRecoveryInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(LoginRecoveryInitializer.class);
    private final UserRepository userRepository;

    public LoginRecoveryInitializer(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public void run(String... args) {
        long totalUsers = userRepository.count();
        if (totalUsers == 0) {
            return;
        }

        long activeUsers = userRepository.countByActiveTrue();
        if (activeUsers > 0) {
            return;
        }

        List<User> users = userRepository.findAll();
        for (User user : users) {
            user.setActive(true);
            user.setDeactivationReason(null);
            user.setDeactivatedAt(null);
        }
        userRepository.saveAll(users);
        log.warn("Auto-reactivated {} users because the system had zero active accounts.", users.size());
    }
}
