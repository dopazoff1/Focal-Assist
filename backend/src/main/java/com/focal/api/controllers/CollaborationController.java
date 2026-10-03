package com.focal.api.controllers;

import com.focal.api.dto.*;
import com.focal.api.models.User;
import com.focal.api.repository.UserRepository;
import com.focal.api.service.CollaborationService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/collaboration")
@CrossOrigin("*")
public class CollaborationController {

    private final CollaborationService collaborationService;
    private final UserRepository userRepository;

    public CollaborationController(CollaborationService collaborationService, UserRepository userRepository) {
        this.collaborationService = collaborationService;
        this.userRepository = userRepository;
    }

    @GetMapping("/workspace")
    public CollaborationWorkspaceDto getWorkspace(Authentication authentication) {
        User user = requireUser(authentication);
        return collaborationService.getWorkspace(user);
    }

    @GetMapping("/channel-access/map")
    public CollaborationChannelAccessMapDto getChannelAccessMap(Authentication authentication) {
        User user = requireUser(authentication);
        return collaborationService.getChannelAccessMap(user);
    }

    @PutMapping("/channel-access/users/{userId}/replace")
    public CollaborationChannelAccessMapDto replaceUserChannelAccess(
        Authentication authentication,
        @PathVariable Long userId,
        @RequestBody CollaborationChannelAccessReplaceRequestDto request
    ) {
        User user = requireUser(authentication);
        return collaborationService.replaceUserChannelAccess(user, userId, request);
    }

    @PostMapping("/channels")
    public CollaborationRoomDto createChannel(
        Authentication authentication,
        @RequestBody CollaborationCreateChannelRequestDto request
    ) {
        User user = requireUser(authentication);
        return collaborationService.createChannel(user, request);
    }

    @PostMapping("/rooms/{roomId}/invite")
    public CollaborationRoomDto inviteMembers(
        Authentication authentication,
        @PathVariable Long roomId,
        @RequestBody CollaborationInviteMembersRequestDto request
    ) {
        User user = requireUser(authentication);
        return collaborationService.inviteMembers(user, roomId, request);
    }

    @PostMapping("/directs")
    public CollaborationRoomDto createDirect(
        Authentication authentication,
        @RequestBody CollaborationCreateDirectRequestDto request
    ) {
        User user = requireUser(authentication);
        return collaborationService.createDirectRoom(user, request);
    }

    @PutMapping("/rooms/{roomId}/topic")
    public CollaborationRoomDto setRoomTopic(
        Authentication authentication,
        @PathVariable Long roomId,
        @RequestBody CollaborationTopicUpdateRequestDto request
    ) {
        User user = requireUser(authentication);
        return collaborationService.setRoomTopic(user, roomId, request);
    }

    @PutMapping("/rooms/{roomId}/articles")
    public CollaborationRoomDto setRoomArticles(
        Authentication authentication,
        @PathVariable Long roomId,
        @RequestBody CollaborationLinkedArticlesRequestDto request
    ) {
        User user = requireUser(authentication);
        return collaborationService.setRoomLinkedArticles(user, roomId, request);
    }

    @GetMapping("/rooms/{roomId}/messages")
    public List<CollaborationMessageDto> getRoomMessages(Authentication authentication, @PathVariable Long roomId) {
        User user = requireUser(authentication);
        return collaborationService.getRoomMessages(user, roomId);
    }

    @PostMapping("/rooms/{roomId}/messages")
    public CollaborationMessageDto sendMessage(
        Authentication authentication,
        @PathVariable Long roomId,
        @RequestBody CollaborationSendMessageRequestDto request
    ) {
        User user = requireUser(authentication);
        return collaborationService.sendMessage(user, roomId, request);
    }

    @PutMapping("/rooms/{roomId}/messages/{messageId}")
    public CollaborationMessageDto editMessage(
        Authentication authentication,
        @PathVariable Long roomId,
        @PathVariable Long messageId,
        @RequestBody CollaborationEditMessageRequestDto request
    ) {
        User user = requireUser(authentication);
        return collaborationService.editMessage(user, roomId, messageId, request);
    }

    @DeleteMapping("/rooms/{roomId}/messages/{messageId}")
    public void deleteMessage(
        Authentication authentication,
        @PathVariable Long roomId,
        @PathVariable Long messageId
    ) {
        User user = requireUser(authentication);
        collaborationService.deleteMessage(user, roomId, messageId);
    }

    @PostMapping("/rooms/{roomId}/messages/{messageId}/reaction")
    public CollaborationMessageDto toggleReaction(
        Authentication authentication,
        @PathVariable Long roomId,
        @PathVariable Long messageId,
        @RequestBody CollaborationReactionRequestDto request
    ) {
        User user = requireUser(authentication);
        return collaborationService.toggleReaction(user, roomId, messageId, request);
    }

    @PostMapping("/rooms/{roomId}/messages/{messageId}/pin")
    public CollaborationMessageDto togglePin(
        Authentication authentication,
        @PathVariable Long roomId,
        @PathVariable Long messageId
    ) {
        User user = requireUser(authentication);
        return collaborationService.togglePinMessage(user, roomId, messageId);
    }

    @PostMapping("/rooms/{roomId}/messages/{messageId}/save")
    public CollaborationPreferencesDto toggleSaveMessage(
        Authentication authentication,
        @PathVariable Long roomId,
        @PathVariable Long messageId
    ) {
        User user = requireUser(authentication);
        return collaborationService.toggleSaveMessage(user, roomId, messageId);
    }

    @PostMapping("/rooms/{roomId}/star")
    public CollaborationPreferencesDto toggleStar(Authentication authentication, @PathVariable Long roomId) {
        User user = requireUser(authentication);
        return collaborationService.toggleRoomStar(user, roomId);
    }

    @PostMapping("/rooms/{roomId}/mute")
    public CollaborationPreferencesDto toggleMute(Authentication authentication, @PathVariable Long roomId) {
        User user = requireUser(authentication);
        return collaborationService.toggleRoomMute(user, roomId);
    }

    @PostMapping("/rooms/{roomId}/read")
    public CollaborationPreferencesDto markRoomRead(Authentication authentication, @PathVariable Long roomId) {
        User user = requireUser(authentication);
        return collaborationService.markRoomRead(user, roomId);
    }

    @PostMapping("/rooms/{roomId}/typing")
    public CollaborationTypingDto setTyping(
        Authentication authentication,
        @PathVariable Long roomId,
        @RequestBody(required = false) CollaborationTypingRequestDto request
    ) {
        User user = requireUser(authentication);
        boolean typing = request != null && Boolean.TRUE.equals(request.getTyping());
        return collaborationService.setTyping(user, roomId, typing);
    }

    @GetMapping("/rooms/{roomId}/typing")
    public CollaborationTypingDto getTyping(
        Authentication authentication,
        @PathVariable Long roomId
    ) {
        User user = requireUser(authentication);
        return collaborationService.getTyping(user, roomId);
    }

    @GetMapping("/messages/search")
    public List<CollaborationMessageDto> searchMessages(
        Authentication authentication,
        @RequestParam("query") String query,
        @RequestParam(value = "roomId", required = false) Long roomId
    ) {
        User user = requireUser(authentication);
        return collaborationService.searchMessages(user, query, roomId);
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
