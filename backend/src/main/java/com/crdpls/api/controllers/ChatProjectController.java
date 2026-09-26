package com.crdpls.api.controllers;

import com.crdpls.api.models.User;
import com.crdpls.api.repository.UserRepository;
import com.crdpls.api.service.ChatProjectService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat-projects")
@CrossOrigin("*")
public class ChatProjectController {
    private final ChatProjectService chatProjectService;
    private final UserRepository userRepository;

    public ChatProjectController(ChatProjectService chatProjectService, UserRepository userRepository) {
        this.chatProjectService = chatProjectService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<Map<String, Object>> list(Authentication authentication, @RequestParam(required = false) String q) {
        requireUser(authentication);
        return chatProjectService.listProjects(q);
    }

    @GetMapping("/agents")
    public List<Map<String, Object>> listAssignableUsers(Authentication authentication) {
        requireSupervisor(authentication);
        return chatProjectService.listAssignableUsers();
    }

    @GetMapping("/{projectId}")
    public Map<String, Object> get(Authentication authentication, @PathVariable Long projectId) {
        requireUser(authentication);
        return chatProjectService.getProject(projectId);
    }

    @PostMapping
    public Map<String, Object> create(Authentication authentication, @RequestBody Map<String, Object> request) {
        requireSupervisor(authentication);
        return chatProjectService.createProject(request == null ? Map.of() : request);
    }

    @PutMapping("/{projectId}")
    public Map<String, Object> update(Authentication authentication, @PathVariable Long projectId, @RequestBody Map<String, Object> request) {
        requireSupervisor(authentication);
        return chatProjectService.updateProject(projectId, request == null ? Map.of() : request);
    }

    @PostMapping("/{projectId}/activate")
    public Map<String, Object> activate(Authentication authentication, @PathVariable Long projectId) {
        requireSupervisor(authentication);
        return chatProjectService.setProjectStatus(projectId, "ACTIVE");
    }

    @PostMapping("/{projectId}/deactivate")
    public Map<String, Object> deactivate(Authentication authentication, @PathVariable Long projectId) {
        requireSupervisor(authentication);
        return chatProjectService.setProjectStatus(projectId, "DRAFT");
    }

    @PostMapping("/{projectId}/archive")
    public Map<String, Object> archive(Authentication authentication, @PathVariable Long projectId) {
        requireSupervisor(authentication);
        return chatProjectService.setProjectStatus(projectId, "ARCHIVED");
    }

    @PostMapping("/{projectId}/duplicate")
    public Map<String, Object> duplicate(Authentication authentication, @PathVariable Long projectId) {
        requireSupervisor(authentication);
        return chatProjectService.duplicateProject(projectId);
    }

    @DeleteMapping("/{projectId}")
    public void delete(Authentication authentication, @PathVariable Long projectId) {
        requireSupervisor(authentication);
        chatProjectService.deleteProject(projectId);
    }

    @GetMapping("/{projectId}/api-keys")
    public List<Map<String, Object>> listApiKeys(Authentication authentication, @PathVariable Long projectId) {
        requireSupervisor(authentication);
        return chatProjectService.listApiKeys(projectId);
    }

    @PostMapping("/{projectId}/api-keys/rotate")
    public Map<String, Object> rotateApiKey(Authentication authentication, @PathVariable Long projectId) {
        requireSupervisor(authentication);
        return chatProjectService.rotateApiKey(projectId);
    }

    @DeleteMapping("/{projectId}/api-keys/{keyId}")
    public void revokeApiKey(Authentication authentication, @PathVariable Long projectId, @PathVariable Long keyId) {
        requireSupervisor(authentication);
        chatProjectService.revokeApiKey(projectId, keyId);
    }

    @GetMapping("/{projectId}/workflow")
    public Map<String, Object> getWorkflow(Authentication authentication, @PathVariable Long projectId) {
        requireUser(authentication);
        return chatProjectService.getWorkflow(projectId);
    }

    @PutMapping("/{projectId}/workflow")
    public Map<String, Object> saveWorkflow(Authentication authentication, @PathVariable Long projectId, @RequestBody Map<String, Object> request) {
        requireSupervisor(authentication);
        return chatProjectService.saveWorkflow(projectId, request == null ? Map.of() : request);
    }

    @PostMapping("/{projectId}/workflow/publish")
    public Map<String, Object> publishWorkflow(Authentication authentication, @PathVariable Long projectId) {
        requireSupervisor(authentication);
        return chatProjectService.publishWorkflow(projectId);
    }

    @GetMapping("/{projectId}/queues")
    public List<Map<String, Object>> listQueues(Authentication authentication, @PathVariable Long projectId) {
        requireUser(authentication);
        return chatProjectService.listQueues(projectId);
    }

    @PostMapping("/{projectId}/queues")
    public Map<String, Object> createQueue(Authentication authentication, @PathVariable Long projectId, @RequestBody Map<String, Object> request) {
        requireSupervisor(authentication);
        return chatProjectService.saveQueue(projectId, null, request == null ? Map.of() : request);
    }

    @PutMapping("/{projectId}/queues/{queueId}")
    public Map<String, Object> updateQueue(Authentication authentication, @PathVariable Long projectId, @PathVariable Long queueId, @RequestBody Map<String, Object> request) {
        requireSupervisor(authentication);
        return chatProjectService.saveQueue(projectId, queueId, request == null ? Map.of() : request);
    }

    @DeleteMapping("/{projectId}/queues/{queueId}")
    public void archiveQueue(Authentication authentication, @PathVariable Long projectId, @PathVariable Long queueId) {
        requireSupervisor(authentication);
        chatProjectService.archiveQueue(projectId, queueId);
    }

    @PutMapping("/{projectId}/queues/{queueId}/agents")
    public Map<String, Object> replaceQueueAgents(
        Authentication authentication,
        @PathVariable Long projectId,
        @PathVariable Long queueId,
        @RequestBody Map<String, Object> request
    ) {
        requireSupervisor(authentication);
        return chatProjectService.replaceQueueAgents(projectId, queueId, request == null ? Map.of() : request);
    }

    private User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        User user = userRepository.findByEmail(authentication.getName());
        if (user == null || !Boolean.TRUE.equals(user.getActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is inactive.");
        }
        return user;
    }

    private User requireSupervisor(Authentication authentication) {
        User user = requireUser(authentication);
        String role = normalizeRole(user.getRole());
        if (!role.equals("ADMIN") && !role.equals("HEAD_CS") && !role.equals("OPS") && !role.equals("TEAM_LEADER") && !role.equals("QA")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Supervisor access required.");
        }
        return user;
    }

    private String normalizeRole(String rawRole) {
        String role = rawRole == null ? "" : rawRole.trim().toUpperCase();
        if (role.startsWith("ROLE_")) role = role.substring("ROLE_".length());
        if (role.equals("HEAD_OF_CS")) return "HEAD_CS";
        if (role.equals("TL")) return "TEAM_LEADER";
        if (role.equals("QUALITY")) return "QA";
        if (role.equals("1")) return "ADMIN";
        if (role.equals("2")) return "AGENT";
        if (role.equals("3")) return "TEAM_LEADER";
        if (role.equals("4")) return "QA";
        if (role.equals("5")) return "HEAD_CS";
        if (role.equals("6")) return "OPS";
        return role;
    }
}
