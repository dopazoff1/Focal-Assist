package com.focal.api.controllers;

import com.focal.api.dto.*;
import com.focal.api.models.User;
import com.focal.api.repository.UserRepository;
import com.focal.api.service.EscalationDeskService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/escalations")
@CrossOrigin("*")
public class EscalationDeskController {

    private final EscalationDeskService escalationDeskService;
    private final UserRepository userRepository;

    public EscalationDeskController(EscalationDeskService escalationDeskService, UserRepository userRepository) {
        this.escalationDeskService = escalationDeskService;
        this.userRepository = userRepository;
    }

    @GetMapping("/workspace")
    public EscalationWorkspaceDto getWorkspace(Authentication authentication) {
        requireUser(authentication);
        return escalationDeskService.getWorkspace();
    }

    @GetMapping("/l2-users")
    public List<EscalationL2UserDto> listL2Users(Authentication authentication) {
        requireUser(authentication);
        return escalationDeskService.listL2Users();
    }

    @PostMapping("/tickets")
    public EscalationTicketDto createTicket(
        Authentication authentication,
        @RequestBody EscalationCreateTicketRequestDto request
    ) {
        User user = requireUser(authentication);
        return escalationDeskService.createTicket(request, user);
    }

    @PostMapping("/tickets/{ticketId}/escalate")
    public EscalationTicketDto escalateTicket(
        Authentication authentication,
        @PathVariable Long ticketId,
        @RequestBody EscalationEscalateRequestDto request
    ) {
        User user = requireUser(authentication);
        return escalationDeskService.escalateTicket(ticketId, request, user);
    }

    @PostMapping("/tickets/{ticketId}/comments")
    public EscalationCommentDto addComment(
        Authentication authentication,
        @PathVariable Long ticketId,
        @RequestBody EscalationAddCommentRequestDto request
    ) {
        User user = requireUser(authentication);
        return escalationDeskService.addComment(ticketId, request, user);
    }

    @PutMapping("/tickets/{ticketId}/assign-l2")
    public EscalationTicketDto assignL2(
        Authentication authentication,
        @PathVariable Long ticketId,
        @RequestBody EscalationAssignL2RequestDto request
    ) {
        User user = requireUser(authentication);
        return escalationDeskService.assignL2(ticketId, request, user);
    }

    @PutMapping("/tickets/{ticketId}/status")
    public EscalationTicketDto updateStatus(
        Authentication authentication,
        @PathVariable Long ticketId,
        @RequestBody EscalationUpdateStatusRequestDto request
    ) {
        User user = requireUser(authentication);
        return escalationDeskService.updateStatus(ticketId, request, user);
    }

    @PostMapping("/tickets/{ticketId}/claim")
    public EscalationClaimResultDto claimForL2(
        Authentication authentication,
        @PathVariable Long ticketId
    ) {
        User user = requireUser(authentication);
        return escalationDeskService.claimForL2(ticketId, user);
    }

    @PutMapping("/tickets/{ticketId}/jira")
    public EscalationTicketDto linkJira(
        Authentication authentication,
        @PathVariable Long ticketId,
        @RequestBody EscalationJiraPatchRequestDto request
    ) {
        User user = requireUser(authentication);
        return escalationDeskService.linkJira(ticketId, request, user);
    }

    @PutMapping("/tickets/{ticketId}/jira-status")
    public EscalationTicketDto updateJiraStatus(
        Authentication authentication,
        @PathVariable Long ticketId,
        @RequestBody EscalationJiraPatchRequestDto request
    ) {
        User user = requireUser(authentication);
        return escalationDeskService.updateJiraStatus(ticketId, request == null ? null : request.getJiraStatus(), user);
    }

    @PostMapping("/tickets/{ticketId}/close-duplicate")
    public EscalationTicketDto closeAsDuplicate(
        Authentication authentication,
        @PathVariable Long ticketId,
        @RequestBody EscalationCloseDuplicateRequestDto request
    ) {
        User user = requireUser(authentication);
        return escalationDeskService.closeAsDuplicate(ticketId, request, user);
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
}
