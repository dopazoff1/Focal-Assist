package com.focal.api.controllers;

import com.focal.api.dto.TeamLinkDto;
import com.focal.api.dto.TeamLinkReplaceForAgentRequestDto;
import com.focal.api.dto.TeamLinkReplaceRequestDto;
import com.focal.api.models.User;
import com.focal.api.repository.UserRepository;
import com.focal.api.service.TeamLinkService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/team-links")
@CrossOrigin("*")
public class TeamLinkController {

    private final TeamLinkService teamLinkService;
    private final UserRepository userRepository;

    public TeamLinkController(TeamLinkService teamLinkService, UserRepository userRepository) {
        this.teamLinkService = teamLinkService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<TeamLinkDto> getAll(Authentication authentication) {
        requireUser(authentication);
        return teamLinkService.getAll();
    }

    @PostMapping("/replace")
    public List<TeamLinkDto> replaceForManager(
        Authentication authentication,
        @RequestBody TeamLinkReplaceRequestDto request
    ) {
        User user = requireUser(authentication);
        ensureCanManageTeamLinks(user);
        return teamLinkService.replaceForManager(
            request == null ? null : request.getManagerRole(),
            request == null ? null : request.getManagerId(),
            request == null ? null : request.getAgentIds()
        );
    }

    @PostMapping("/agent/{agentId}/replace")
    public List<TeamLinkDto> replaceForAgent(
        Authentication authentication,
        @PathVariable Long agentId,
        @RequestBody TeamLinkReplaceForAgentRequestDto request
    ) {
        User user = requireUser(authentication);
        ensureCanManageTeamLinks(user);
        return teamLinkService.replaceForAgent(
            agentId,
            request == null ? null : request.getTeamLeaderId(),
            request == null ? null : request.getQaId()
        );
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

    private void ensureCanManageTeamLinks(User user) {
        String role = user == null || user.getRole() == null ? "" : user.getRole().trim().toUpperCase();
        boolean allowed = role.equals("ADMIN")
            || role.equals("ROLE_ADMIN")
            || role.equals("HEAD_CS")
            || role.equals("ROLE_HEAD_CS")
            || role.equals("OPS")
            || role.equals("ROLE_OPS")
            || role.equals("1")
            || role.equals("5")
            || role.equals("6");
        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
    }
}
