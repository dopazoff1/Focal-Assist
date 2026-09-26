package com.crdpls.api.service;

import com.crdpls.api.dto.*;
import com.crdpls.api.models.*;
import com.crdpls.api.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@Transactional
public class CollaborationService {

    private static final Pattern MENTION_PATTERN = Pattern.compile("@([a-zA-Z0-9._-]+)");
    private static final long TYPING_TTL_SECONDS = 8L;

    private final UserRepository userRepository;
    private final CollaborationRoomRepository roomRepository;
    private final CollaborationRoomMemberRepository roomMemberRepository;
    private final CollaborationRoomArticleRepository roomArticleRepository;
    private final CollaborationMessageRepository messageRepository;
    private final CollaborationMessageMentionRepository messageMentionRepository;
    private final CollaborationMessageArticleRepository messageArticleRepository;
    private final CollaborationMessageReactionRepository messageReactionRepository;
    private final CollaborationUserPreferenceRepository preferenceRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, LocalDateTime> typingState = new ConcurrentHashMap<>();

    public CollaborationService(
        UserRepository userRepository,
        CollaborationRoomRepository roomRepository,
        CollaborationRoomMemberRepository roomMemberRepository,
        CollaborationRoomArticleRepository roomArticleRepository,
        CollaborationMessageRepository messageRepository,
        CollaborationMessageMentionRepository messageMentionRepository,
        CollaborationMessageArticleRepository messageArticleRepository,
        CollaborationMessageReactionRepository messageReactionRepository,
        CollaborationUserPreferenceRepository preferenceRepository
    ) {
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.roomMemberRepository = roomMemberRepository;
        this.roomArticleRepository = roomArticleRepository;
        this.messageRepository = messageRepository;
        this.messageMentionRepository = messageMentionRepository;
        this.messageArticleRepository = messageArticleRepository;
        this.messageReactionRepository = messageReactionRepository;
        this.preferenceRepository = preferenceRepository;
    }

    public CollaborationWorkspaceDto getWorkspace(User currentUser) {
        ensureBaseWorkspace(currentUser);

        List<CollaborationRoom> visibleRooms = getVisibleRooms(currentUser);
        Map<Long, List<CollaborationRoomMember>> membersByRoom = groupMembersByRoom(visibleRooms);
        Map<Long, List<Long>> roomArticlesByRoom = groupRoomArticlesByRoom(visibleRooms);
        Map<Long, CollaborationMessage> latestMessageByRoom = getLatestMessagesByRoom(visibleRooms);

        List<User> activeUsers = userRepository.findAll().stream()
            .filter(user -> Boolean.TRUE.equals(user.getActive()))
            .toList();

        CollaborationUserPreference pref = getOrCreatePreference(currentUser);
        ParsedPreference parsedPreference = parsePreference(pref);

        Map<String, Integer> unreadByRoom = computeUnreadByRoom(currentUser, visibleRooms, parsedPreference.lastReadAtByRoom);
        List<CollaborationMessageDto> mentionInbox = buildMentionInbox(currentUser, visibleRooms);
        List<CollaborationMessageDto> savedMessages = buildSavedMessages(currentUser, visibleRooms, parsedPreference.savedMessageIds);

        List<CollaborationRoom> sortedRooms = visibleRooms.stream()
            .sorted((a, b) -> {
                LocalDateTime aTs = latestMessageByRoom.get(a.getId()) != null
                    ? latestMessageByRoom.get(a.getId()).getCreatedAt()
                    : a.getUpdatedAt();
                LocalDateTime bTs = latestMessageByRoom.get(b.getId()) != null
                    ? latestMessageByRoom.get(b.getId()).getCreatedAt()
                    : b.getUpdatedAt();
                return bTs.compareTo(aTs);
            })
            .toList();

        List<CollaborationRoomDto> roomDtos = sortedRooms.stream()
            .map(room -> toRoomDto(room, membersByRoom.getOrDefault(room.getId(), List.of()), roomArticlesByRoom.getOrDefault(room.getId(), List.of())))
            .toList();

        CollaborationWorkspaceDto dto = new CollaborationWorkspaceDto();
        dto.setUsers(activeUsers.stream().map(this::toUserDto).toList());
        dto.setRooms(roomDtos);
        dto.setChannels(roomDtos.stream().filter(room -> "CHANNEL".equals(room.getKind())).toList());
        dto.setDirects(roomDtos.stream().filter(room -> "DIRECT".equals(room.getKind())).toList());
        dto.setPreferences(toPreferencesDto(parsedPreference));
        dto.setUnreadByRoom(unreadByRoom);
        dto.setMentionInbox(mentionInbox);
        dto.setSavedMessages(savedMessages);
        return dto;
    }

    public CollaborationChannelAccessMapDto getChannelAccessMap(User currentUser) {
        ensureAdmin(currentUser);
        ensureBaseWorkspace(currentUser);

        List<User> activeUsers = userRepository.findAll().stream()
            .filter(user -> Boolean.TRUE.equals(user.getActive()))
            .sorted(Comparator.comparing(this::targetDisplayName, String.CASE_INSENSITIVE_ORDER))
            .toList();

        List<CollaborationRoom> channels = roomRepository.findByKindAndArchivedFalse("CHANNEL").stream()
            .sorted(Comparator.comparing(room -> trimToEmpty(room.getName()), String.CASE_INSENSITIVE_ORDER))
            .toList();

        Map<Long, List<CollaborationRoomMember>> membersByRoom = groupMembersByRoom(channels);
        Map<Long, List<Long>> roomArticlesByRoom = groupRoomArticlesByRoom(channels);

        List<CollaborationRoomDto> channelDtos = channels.stream()
            .map(channel -> toChannelAccessRoomDto(
                channel,
                membersByRoom.getOrDefault(channel.getId(), List.of()),
                roomArticlesByRoom.getOrDefault(channel.getId(), List.of())
            ))
            .toList();

        Set<Long> activeUserIds = activeUsers.stream()
            .map(User::getId)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<String, List<Long>> channelIdsByUserId = new LinkedHashMap<>();
        for (User user : activeUsers) {
            channelIdsByUserId.put(String.valueOf(user.getId()), new ArrayList<>());
        }

        for (CollaborationRoomDto channel : channelDtos) {
            Long channelId = parseStringId(channel.getId());
            if (channelId == null) continue;
            for (Long memberId : channel.getMemberIds()) {
                if (memberId == null || !activeUserIds.contains(memberId)) continue;
                channelIdsByUserId
                    .computeIfAbsent(String.valueOf(memberId), key -> new ArrayList<>())
                    .add(channelId);
            }
        }

        for (Map.Entry<String, List<Long>> entry : channelIdsByUserId.entrySet()) {
            entry.setValue(entry.getValue().stream()
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList());
        }

        CollaborationChannelAccessMapDto dto = new CollaborationChannelAccessMapDto();
        dto.setUsers(activeUsers.stream().map(this::toUserDto).toList());
        dto.setChannels(channelDtos);
        dto.setChannelIdsByUserId(channelIdsByUserId);
        return dto;
    }

    public CollaborationChannelAccessMapDto replaceUserChannelAccess(
        User currentUser,
        Long targetUserId,
        CollaborationChannelAccessReplaceRequestDto request
    ) {
        ensureAdmin(currentUser);
        User targetUser = findActiveUser(targetUserId);

        List<CollaborationRoom> channels = roomRepository.findByKindAndArchivedFalse("CHANNEL");
        Set<Long> allowedChannelIds = channels.stream()
            .map(CollaborationRoom::getId)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        Set<Long> requestedChannelIds = uniquePositiveIds(request == null ? null : request.getChannelIds()).stream()
            .filter(allowedChannelIds::contains)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        for (CollaborationRoom channel : channels) {
            boolean ownerMustStay = channel.getOwnerUser() != null
                && Objects.equals(channel.getOwnerUser().getId(), targetUser.getId());
            boolean shouldBeMember = ownerMustStay || requestedChannelIds.contains(channel.getId());
            boolean isMember = roomMemberRepository.existsByRoomIdAndUserId(channel.getId(), targetUser.getId());

            if (shouldBeMember && !isMember) {
                addRoomMember(channel, targetUser);
                createSystemMessage(
                    channel,
                    currentUser,
                    targetDisplayName(targetUser) + " was granted access to #" + trimToEmpty(channel.getName()) + "."
                );
                touchRoom(channel);
                continue;
            }

            if (!shouldBeMember && isMember) {
                roomMemberRepository.deleteByRoomIdAndUserId(channel.getId(), targetUser.getId());
                createSystemMessage(
                    channel,
                    currentUser,
                    targetDisplayName(targetUser) + " was removed from #" + trimToEmpty(channel.getName()) + "."
                );
                touchRoom(channel);
            }
        }

        return getChannelAccessMap(currentUser);
    }

    public CollaborationRoomDto createChannel(User currentUser, CollaborationCreateChannelRequestDto request) {
        ensureAdmin(currentUser);
        if (request == null || request.getName() == null || request.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Channel name is required.");
        }

        CollaborationRoom room = new CollaborationRoom();
        room.setKind("CHANNEL");
        room.setName(normalizeChannelName(request.getName()));
        room.setDescription(trimToEmpty(request.getDescription()));
        room.setTopic(trimToEmpty(request.getTopic()));
        room.setIsPrivate(Boolean.TRUE.equals(request.getIsPrivate()));
        room.setOwnerUser(currentUser);
        room.setArchived(false);
        room = roomRepository.save(room);

        addRoomMember(room, currentUser);
        Set<Long> toInvite = uniquePositiveIds(request.getMemberIds());
        toInvite.remove(currentUser.getId());
        for (Long userId : toInvite) {
            User target = findActiveUser(userId);
            addRoomMember(room, target);
            createSystemMessage(room, currentUser, targetDisplayName(target) + " was invited to #" + room.getName() + ".");
        }
        createSystemMessage(room, currentUser, "Channel #" + room.getName() + " created.");
        touchRoom(room);
        return toRoomDto(room, roomMemberRepository.findByRoomId(room.getId()), List.of());
    }

    public CollaborationRoomDto inviteMembers(User currentUser, Long roomId, CollaborationInviteMembersRequestDto request) {
        ensureAdmin(currentUser);
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        if (!"CHANNEL".equals(room.getKind())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitations are supported only for channels.");
        }

        Set<Long> toInvite = uniquePositiveIds(request == null ? null : request.getMemberIds());
        toInvite.remove(currentUser.getId());
        for (Long userId : toInvite) {
            if (roomMemberRepository.existsByRoomIdAndUserId(room.getId(), userId)) continue;
            User target = findActiveUser(userId);
            addRoomMember(room, target);
            createSystemMessage(room, currentUser, targetDisplayName(target) + " was invited to #" + room.getName() + ".");
        }
        touchRoom(room);

        List<Long> linkedArticles = roomArticleRepository.findByRoomId(room.getId()).stream()
            .map(CollaborationRoomArticle::getArticleId)
            .distinct()
            .toList();
        return toRoomDto(room, roomMemberRepository.findByRoomId(room.getId()), linkedArticles);
    }

    public CollaborationRoomDto createDirectRoom(User currentUser, CollaborationCreateDirectRequestDto request) {
        Long targetUserId = request == null ? null : request.getTargetUserId();
        if (targetUserId == null || targetUserId <= 0 || targetUserId.equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid direct room target user.");
        }
        User target = findActiveUser(targetUserId);

        List<Long> visibleRoomIds = roomMemberRepository.findRoomIdsByUserId(currentUser.getId());
        for (Long candidateId : visibleRoomIds) {
            CollaborationRoom room = roomRepository.findById(candidateId).orElse(null);
            if (room == null || room.getArchived() || !"DIRECT".equals(room.getKind())) continue;
            List<Long> memberIds = roomMemberRepository.findByRoomId(room.getId()).stream()
                .map(member -> member.getUser().getId())
                .distinct()
                .sorted()
                .toList();
            if (memberIds.size() == 2 && memberIds.contains(currentUser.getId()) && memberIds.contains(target.getId())) {
                List<Long> linked = roomArticleRepository.findByRoomId(room.getId()).stream()
                    .map(CollaborationRoomArticle::getArticleId)
                    .distinct()
                    .toList();
                return toRoomDto(room, roomMemberRepository.findByRoomId(room.getId()), linked);
            }
        }

        CollaborationRoom room = new CollaborationRoom();
        room.setKind("DIRECT");
        room.setName(null);
        room.setDescription("");
        room.setTopic("");
        room.setIsPrivate(true);
        room.setOwnerUser(currentUser);
        room.setArchived(false);
        room = roomRepository.save(room);
        addRoomMember(room, currentUser);
        addRoomMember(room, target);
        createSystemMessage(room, currentUser, "Direct channel created. Keep it private and actionable.");
        touchRoom(room);
        return toRoomDto(room, roomMemberRepository.findByRoomId(room.getId()), List.of());
    }

    public CollaborationRoomDto setRoomTopic(User currentUser, Long roomId, CollaborationTopicUpdateRequestDto request) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        if (!"CHANNEL".equals(room.getKind())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Topic can be changed only on channels.");
        }
        room.setTopic(trimToEmpty(request == null ? null : request.getTopic()));
        touchRoom(room);
        List<Long> linked = roomArticleRepository.findByRoomId(room.getId()).stream()
            .map(CollaborationRoomArticle::getArticleId)
            .distinct()
            .toList();
        return toRoomDto(room, roomMemberRepository.findByRoomId(room.getId()), linked);
    }

    public CollaborationRoomDto setRoomLinkedArticles(User currentUser, Long roomId, CollaborationLinkedArticlesRequestDto request) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        Set<Long> nextArticleIds = uniquePositiveIds(request == null ? null : request.getArticleIds());
        roomArticleRepository.deleteByRoomId(room.getId());
        for (Long articleId : nextArticleIds) {
            CollaborationRoomArticle row = new CollaborationRoomArticle();
            row.setRoom(room);
            row.setArticleId(articleId);
            roomArticleRepository.save(row);
        }
        touchRoom(room);
        return toRoomDto(room, roomMemberRepository.findByRoomId(room.getId()), new ArrayList<>(nextArticleIds));
    }

    @Transactional(readOnly = true)
    public List<CollaborationMessageDto> getRoomMessages(User currentUser, Long roomId) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        List<CollaborationMessage> messages = messageRepository.findByRoomIdOrderByCreatedAtAsc(room.getId());
        List<CollaborationMessageDto> dtos = toMessageDtos(messages);
        applyDirectDeliveryState(room, currentUser, messages, dtos);
        return dtos;
    }

    public CollaborationMessageDto sendMessage(User currentUser, Long roomId, CollaborationSendMessageRequestDto request) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        String content = trimToEmpty(request == null ? null : request.getContent());
        if (content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message is empty.");
        }

        CollaborationMessage parent = null;
        Long parentId = "DIRECT".equals(safeUpper(room.getKind(), ""))
            ? null
            : parseStringId(request == null ? null : request.getParentId());
        if (parentId != null) {
            parent = messageRepository.findById(parentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parent message not found."));
            if (!parent.getRoom().getId().equals(room.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parent message belongs to another room.");
            }
        }

        CollaborationMessage message = new CollaborationMessage();
        message.setRoom(room);
        message.setSenderUser(currentUser);
        message.setKind("USER");
        message.setContent(content);
        message.setParentMessage(parent);
        message.setPinned(false);
        message = messageRepository.save(message);

        persistMessageMentions(message, content);
        persistMessageArticles(message, request == null ? null : request.getLinkedArticleIds());
        touchRoom(room);
        typingState.remove(buildTypingKey(room.getId(), currentUser.getId()));

        return toMessageDto(message, loadMentions(List.of(message.getId())), loadMessageArticles(List.of(message.getId())), loadReactions(List.of(message.getId())));
    }

    public CollaborationMessageDto editMessage(User currentUser, Long roomId, Long messageId, CollaborationEditMessageRequestDto request) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        CollaborationMessage message = getMessageForRoom(room, messageId);
        if (!"USER".equals(message.getKind()) || !message.getSenderUser().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only your own user messages can be edited.");
        }

        String content = trimToEmpty(request == null ? null : request.getContent());
        if (content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message cannot be empty.");
        }

        message.setContent(content);
        message.setEditedAt(LocalDateTime.now());
        messageRepository.save(message);

        messageMentionRepository.deleteByMessageIdIn(List.of(message.getId()));
        persistMessageMentions(message, content);
        touchRoom(room);

        return toMessageDto(message, loadMentions(List.of(message.getId())), loadMessageArticles(List.of(message.getId())), loadReactions(List.of(message.getId())));
    }

    public void deleteMessage(User currentUser, Long roomId, Long messageId) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        CollaborationMessage root = getMessageForRoom(room, messageId);
        boolean isAdmin = isAdmin(currentUser);
        boolean ownsMessage = root.getSenderUser().getId().equals(currentUser.getId());
        if (!ownsMessage && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only delete your own messages.");
        }

        List<CollaborationMessage> roomMessages = messageRepository.findByRoomIdOrderByCreatedAtAsc(room.getId());
        Map<Long, List<CollaborationMessage>> childrenByParent = new HashMap<>();
        for (CollaborationMessage item : roomMessages) {
            if (item.getParentMessage() == null) continue;
            childrenByParent.computeIfAbsent(item.getParentMessage().getId(), key -> new ArrayList<>()).add(item);
        }

        Set<Long> toDeleteIds = new LinkedHashSet<>();
        collectMessageDescendants(root.getId(), childrenByParent, toDeleteIds);

        if (!toDeleteIds.isEmpty()) {
            List<Long> idList = new ArrayList<>(toDeleteIds);
            messageMentionRepository.deleteByMessageIdIn(idList);
            messageArticleRepository.deleteByMessageIdIn(idList);
            messageReactionRepository.deleteByMessageIdIn(idList);
            messageRepository.deleteAllById(idList);
            removeDeletedIdsFromPreferences(idList);
        }
        touchRoom(room);
    }

    public CollaborationMessageDto toggleReaction(User currentUser, Long roomId, Long messageId, CollaborationReactionRequestDto request) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        CollaborationMessage message = getMessageForRoom(room, messageId);
        String emoji = trimToEmpty(request == null ? null : request.getEmoji());
        if (emoji.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reaction is invalid.");
        }

        Optional<CollaborationMessageReaction> existing =
            messageReactionRepository.findByMessageIdAndEmojiAndUserId(message.getId(), emoji, currentUser.getId());
        if (existing.isPresent()) {
            messageReactionRepository.delete(existing.get());
        } else {
            CollaborationMessageReaction reaction = new CollaborationMessageReaction();
            reaction.setMessage(message);
            reaction.setEmoji(emoji);
            reaction.setUser(currentUser);
            messageReactionRepository.save(reaction);
        }
        touchRoom(room);
        return toMessageDto(message, loadMentions(List.of(message.getId())), loadMessageArticles(List.of(message.getId())), loadReactions(List.of(message.getId())));
    }

    public CollaborationMessageDto togglePinMessage(User currentUser, Long roomId, Long messageId) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        CollaborationMessage message = getMessageForRoom(room, messageId);
        message.setPinned(!Boolean.TRUE.equals(message.getPinned()));
        messageRepository.save(message);
        touchRoom(room);
        return toMessageDto(message, loadMentions(List.of(message.getId())), loadMessageArticles(List.of(message.getId())), loadReactions(List.of(message.getId())));
    }

    public CollaborationPreferencesDto toggleSaveMessage(User currentUser, Long roomId, Long messageId) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        getMessageForRoom(room, messageId);
        CollaborationUserPreference pref = getOrCreatePreference(currentUser);
        ParsedPreference parsed = parsePreference(pref);
        String key = String.valueOf(messageId);
        if (parsed.savedMessageIds.contains(key)) {
            parsed.savedMessageIds.remove(key);
        } else {
            parsed.savedMessageIds.add(key);
        }
        persistPreference(pref, parsed);
        return toPreferencesDto(parsed);
    }

    public CollaborationPreferencesDto toggleRoomStar(User currentUser, Long roomId) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        CollaborationUserPreference pref = getOrCreatePreference(currentUser);
        ParsedPreference parsed = parsePreference(pref);
        String key = String.valueOf(room.getId());
        if (parsed.starredRoomIds.contains(key)) {
            parsed.starredRoomIds.remove(key);
        } else {
            parsed.starredRoomIds.add(key);
        }
        persistPreference(pref, parsed);
        return toPreferencesDto(parsed);
    }

    public CollaborationPreferencesDto toggleRoomMute(User currentUser, Long roomId) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        CollaborationUserPreference pref = getOrCreatePreference(currentUser);
        ParsedPreference parsed = parsePreference(pref);
        String key = String.valueOf(room.getId());
        if (parsed.mutedRoomIds.contains(key)) {
            parsed.mutedRoomIds.remove(key);
        } else {
            parsed.mutedRoomIds.add(key);
        }
        persistPreference(pref, parsed);
        return toPreferencesDto(parsed);
    }

    public CollaborationPreferencesDto markRoomRead(User currentUser, Long roomId) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        List<CollaborationMessage> messages = messageRepository.findByRoomIdOrderByCreatedAtAsc(room.getId());
        String latest = messages.isEmpty()
            ? LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant().toString()
            : messages.get(messages.size() - 1).getCreatedAt().atZone(ZoneId.systemDefault()).toInstant().toString();

        CollaborationUserPreference pref = getOrCreatePreference(currentUser);
        ParsedPreference parsed = parsePreference(pref);
        parsed.lastReadAtByRoom.put(String.valueOf(room.getId()), latest);
        persistPreference(pref, parsed);
        return toPreferencesDto(parsed);
    }

    public CollaborationTypingDto setTyping(User currentUser, Long roomId, boolean typing) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        cleanupExpiredTyping();
        String key = buildTypingKey(room.getId(), currentUser.getId());
        if (typing) {
            typingState.put(key, LocalDateTime.now());
        } else {
            typingState.remove(key);
        }
        return buildTypingDto(room, currentUser);
    }

    @Transactional(readOnly = true)
    public CollaborationTypingDto getTyping(User currentUser, Long roomId) {
        CollaborationRoom room = getRoomForMember(currentUser, roomId);
        cleanupExpiredTyping();
        return buildTypingDto(room, currentUser);
    }

    @Transactional(readOnly = true)
    public List<CollaborationMessageDto> searchMessages(User currentUser, String query, Long roomId) {
        String q = trimToEmpty(query);
        if (q.isBlank()) return List.of();
        Set<Long> visibleRoomIds = getVisibleRooms(currentUser).stream()
            .map(CollaborationRoom::getId)
            .collect(Collectors.toSet());
        if (roomId != null) {
            CollaborationRoom room = getRoomForMember(currentUser, roomId);
            visibleRoomIds = Set.of(room.getId());
        }
        final Set<Long> allowedRoomIds = visibleRoomIds;
        List<CollaborationMessage> matches = messageRepository.findByContentContainingIgnoreCaseOrderByCreatedAtDesc(q).stream()
            .filter(item -> allowedRoomIds.contains(item.getRoom().getId()))
            .toList();
        return toMessageDtos(matches);
    }

    private void ensureBaseWorkspace(User currentUser) {
        if (roomRepository.count() > 0) {
            return;
        }

        CollaborationRoom general = new CollaborationRoom();
        general.setKind("CHANNEL");
        general.setName("general");
        general.setDescription("Company-wide updates and announcements.");
        general.setTopic("Daily standups, priorities, blockers.");
        general.setIsPrivate(false);
        general.setOwnerUser(currentUser);
        general.setArchived(false);
        general = roomRepository.save(general);
        addRoomMember(general, currentUser);
        createSystemMessage(general, currentUser, "Welcome to #general. Use this for shared context.");
        createSystemMessage(general, currentUser, "Tip: mention teammates with @handle and pin key decisions.");

        CollaborationRoom supportOps = new CollaborationRoom();
        supportOps.setKind("CHANNEL");
        supportOps.setName("support-ops");
        supportOps.setDescription("Runbook-driven support operations channel.");
        supportOps.setTopic("Escalations, SLA risks, staffing coordination.");
        supportOps.setIsPrivate(false);
        supportOps.setOwnerUser(currentUser);
        supportOps.setArchived(false);
        supportOps = roomRepository.save(supportOps);
        addRoomMember(supportOps, currentUser);
        createSystemMessage(supportOps, currentUser, "Welcome to #support-ops. Track urgent issues and owners.");
        createSystemMessage(supportOps, currentUser, "Tip: link KB articles to messages for reusable guidance.");
    }

    private List<CollaborationRoom> getVisibleRooms(User currentUser) {
        List<Long> roomIds = roomMemberRepository.findRoomIdsByUserId(currentUser.getId());
        if (roomIds.isEmpty()) return List.of();
        return roomRepository.findByIdInAndArchivedFalse(roomIds);
    }

    private Map<Long, List<CollaborationRoomMember>> groupMembersByRoom(List<CollaborationRoom> rooms) {
        if (rooms.isEmpty()) return Map.of();
        List<Long> roomIds = rooms.stream().map(CollaborationRoom::getId).toList();
        return roomMemberRepository.findByRoomIdIn(roomIds).stream()
            .collect(Collectors.groupingBy(member -> member.getRoom().getId()));
    }

    private Map<Long, List<Long>> groupRoomArticlesByRoom(List<CollaborationRoom> rooms) {
        if (rooms.isEmpty()) return Map.of();
        List<Long> roomIds = rooms.stream().map(CollaborationRoom::getId).toList();
        return roomArticleRepository.findByRoomIdIn(roomIds).stream()
            .collect(Collectors.groupingBy(
                row -> row.getRoom().getId(),
                Collectors.mapping(CollaborationRoomArticle::getArticleId, Collectors.toList())
            ));
    }

    private Map<Long, CollaborationMessage> getLatestMessagesByRoom(List<CollaborationRoom> rooms) {
        if (rooms.isEmpty()) return Map.of();
        List<Long> roomIds = rooms.stream().map(CollaborationRoom::getId).toList();
        Map<Long, CollaborationMessage> map = new HashMap<>();
        for (CollaborationMessage message : messageRepository.findByRoomIdInOrderByCreatedAtAsc(roomIds)) {
            map.put(message.getRoom().getId(), message);
        }
        return map;
    }

    private Map<String, Integer> computeUnreadByRoom(User currentUser, List<CollaborationRoom> rooms, Map<String, String> lastReadAtByRoom) {
        Map<String, Integer> unread = new HashMap<>();
        for (CollaborationRoom room : rooms) {
            List<CollaborationMessage> messages = messageRepository.findByRoomIdOrderByCreatedAtAsc(room.getId());
            String lastReadIso = lastReadAtByRoom.getOrDefault(String.valueOf(room.getId()), "");
            LocalDateTime lastReadAt = parseIsoLocalDateTime(lastReadIso);
            int count = 0;
            for (CollaborationMessage message : messages) {
                if (message.getSenderUser() == null || Objects.equals(message.getSenderUser().getId(), currentUser.getId())) {
                    continue;
                }
                if (lastReadAt == null || message.getCreatedAt().isAfter(lastReadAt)) {
                    count += 1;
                }
            }
            unread.put(String.valueOf(room.getId()), count);
        }
        return unread;
    }

    private List<CollaborationMessageDto> buildMentionInbox(User currentUser, List<CollaborationRoom> visibleRooms) {
        Set<Long> roomIds = visibleRooms.stream().map(CollaborationRoom::getId).collect(Collectors.toSet());
        if (roomIds.isEmpty()) return List.of();
        List<CollaborationMessageMention> mentions =
            messageMentionRepository.findByUserIdOrderByMessage_CreatedAtDesc(currentUser.getId());
        List<CollaborationMessage> messages = mentions.stream()
            .map(CollaborationMessageMention::getMessage)
            .filter(message -> message != null && roomIds.contains(message.getRoom().getId()))
            .filter(message -> !Objects.equals(message.getSenderUser().getId(), currentUser.getId()))
            .distinct()
            .limit(40)
            .toList();
        return toMessageDtos(messages);
    }

    private List<CollaborationMessageDto> buildSavedMessages(User currentUser, List<CollaborationRoom> visibleRooms, Set<String> savedMessageIds) {
        Set<Long> roomIds = visibleRooms.stream().map(CollaborationRoom::getId).collect(Collectors.toSet());
        List<Long> ids = savedMessageIds.stream()
            .map(this::parseStringId)
            .filter(Objects::nonNull)
            .toList();
        if (ids.isEmpty()) return List.of();
        List<CollaborationMessage> messages = messageRepository.findAllById(ids).stream()
            .filter(message -> roomIds.contains(message.getRoom().getId()))
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .toList();
        return toMessageDtos(messages);
    }

    private List<CollaborationMessageDto> toMessageDtos(List<CollaborationMessage> messages) {
        if (messages.isEmpty()) return List.of();
        List<Long> messageIds = messages.stream().map(CollaborationMessage::getId).toList();
        Map<Long, List<Long>> mentionMap = loadMentions(messageIds);
        Map<Long, List<Long>> articleMap = loadMessageArticles(messageIds);
        Map<Long, Map<String, List<Long>>> reactionMap = loadReactions(messageIds);
        return messages.stream()
            .map(message -> toMessageDto(message, mentionMap, articleMap, reactionMap))
            .toList();
    }

    private void applyDirectDeliveryState(
        CollaborationRoom room,
        User currentUser,
        List<CollaborationMessage> messages,
        List<CollaborationMessageDto> dtos
    ) {
        if (!"DIRECT".equals(safeUpper(room == null ? null : room.getKind(), ""))) {
            return;
        }
        if (messages == null || dtos == null || messages.size() != dtos.size()) {
            return;
        }

        List<Long> peerIds = roomMemberRepository.findByRoomId(room.getId()).stream()
            .map(member -> member.getUser() == null ? null : member.getUser().getId())
            .filter(Objects::nonNull)
            .filter(id -> !Objects.equals(id, currentUser.getId()))
            .distinct()
            .toList();
        if (peerIds.isEmpty()) {
            return;
        }

        Long peerId = peerIds.get(0);
        Map<String, String> peerLastReadMap = preferenceRepository.findByUserId(peerId)
            .map(this::parsePreference)
            .map(parsed -> parsed.lastReadAtByRoom)
            .orElse(Map.of());
        LocalDateTime peerLastReadAt = parseIsoLocalDateTime(peerLastReadMap.getOrDefault(String.valueOf(room.getId()), ""));

        for (int index = 0; index < messages.size(); index++) {
            CollaborationMessage message = messages.get(index);
            CollaborationMessageDto dto = dtos.get(index);
            if (message == null || dto == null) continue;
            if (!Objects.equals(message.getSenderUser().getId(), currentUser.getId())) continue;
            if (!"USER".equals(safeUpper(message.getKind(), "USER"))) continue;

            boolean seen = peerLastReadAt != null && !message.getCreatedAt().isAfter(peerLastReadAt);
            dto.setDeliveryState(seen ? "SEEN" : "SENT");
        }
    }

    private CollaborationMessageDto toMessageDto(
        CollaborationMessage message,
        Map<Long, List<Long>> mentionMap,
        Map<Long, List<Long>> articleMap,
        Map<Long, Map<String, List<Long>>> reactionMap
    ) {
        CollaborationMessageDto dto = new CollaborationMessageDto();
        dto.setId(String.valueOf(message.getId()));
        dto.setRoomId(String.valueOf(message.getRoom().getId()));
        dto.setSenderId(message.getSenderUser().getId());
        dto.setKind(safeUpper(message.getKind(), "USER"));
        dto.setContent(message.getContent() == null ? "" : message.getContent());
        dto.setCreatedAt(message.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant().toString());
        dto.setEditedAt(message.getEditedAt() == null ? null : message.getEditedAt().atZone(ZoneId.systemDefault()).toInstant().toString());
        dto.setParentId(message.getParentMessage() == null ? null : String.valueOf(message.getParentMessage().getId()));
        dto.setPinned(Boolean.TRUE.equals(message.getPinned()));
        dto.setMentionUserIds(mentionMap.getOrDefault(message.getId(), List.of()));
        dto.setLinkedArticleIds(articleMap.getOrDefault(message.getId(), List.of()));
        dto.setReactions(reactionMap.getOrDefault(message.getId(), Map.of()));
        return dto;
    }

    private Map<Long, List<Long>> loadMentions(List<Long> messageIds) {
        if (messageIds.isEmpty()) return Map.of();
        return messageMentionRepository.findByMessageIdIn(messageIds).stream()
            .collect(Collectors.groupingBy(
                mention -> mention.getMessage().getId(),
                Collectors.mapping(mention -> mention.getUser().getId(), Collectors.toList())
            ));
    }

    private Map<Long, List<Long>> loadMessageArticles(List<Long> messageIds) {
        if (messageIds.isEmpty()) return Map.of();
        return messageArticleRepository.findByMessageIdIn(messageIds).stream()
            .collect(Collectors.groupingBy(
                row -> row.getMessage().getId(),
                Collectors.mapping(CollaborationMessageArticle::getArticleId, Collectors.toList())
            ));
    }

    private Map<Long, Map<String, List<Long>>> loadReactions(List<Long> messageIds) {
        if (messageIds.isEmpty()) return Map.of();
        Map<Long, Map<String, List<Long>>> byMessage = new HashMap<>();
        for (CollaborationMessageReaction reaction : messageReactionRepository.findByMessageIdIn(messageIds)) {
            Long messageId = reaction.getMessage().getId();
            String emoji = reaction.getEmoji();
            Long userId = reaction.getUser().getId();
            byMessage
                .computeIfAbsent(messageId, key -> new LinkedHashMap<>())
                .computeIfAbsent(emoji, key -> new ArrayList<>())
                .add(userId);
        }
        return byMessage;
    }

    private CollaborationRoomDto toRoomDto(CollaborationRoom room, List<CollaborationRoomMember> members, List<Long> linkedArticleIds) {
        CollaborationRoomDto dto = new CollaborationRoomDto();
        dto.setId(String.valueOf(room.getId()));
        dto.setKind(safeUpper(room.getKind(), "CHANNEL"));
        dto.setName(room.getName());
        dto.setDescription(room.getDescription() == null ? "" : room.getDescription());
        dto.setTopic(room.getTopic() == null ? "" : room.getTopic());
        dto.setIsPrivate(Boolean.TRUE.equals(room.getIsPrivate()));
        dto.setMemberIds(members.stream().map(member -> member.getUser().getId()).distinct().toList());
        dto.setOwnerId(room.getOwnerUser() == null ? null : room.getOwnerUser().getId());
        dto.setCreatedAt(room.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant().toString());
        dto.setLinkedArticleIds(linkedArticleIds.stream().filter(Objects::nonNull).distinct().toList());
        dto.setArchived(Boolean.TRUE.equals(room.getArchived()));
        return dto;
    }

    private CollaborationRoomDto toChannelAccessRoomDto(
        CollaborationRoom room,
        List<CollaborationRoomMember> members,
        List<Long> linkedArticleIds
    ) {
        CollaborationRoomDto dto = toRoomDto(room, members, linkedArticleIds);
        Long ownerId = room.getOwnerUser() == null ? null : room.getOwnerUser().getId();
        if (ownerId != null && ownerId > 0 && !dto.getMemberIds().contains(ownerId)) {
            List<Long> nextMemberIds = new ArrayList<>(dto.getMemberIds());
            nextMemberIds.add(ownerId);
            dto.setMemberIds(nextMemberIds.stream().filter(Objects::nonNull).distinct().sorted().toList());
        }
        return dto;
    }

    private CollaborationUserDto toUserDto(User user) {
        CollaborationUserDto dto = new CollaborationUserDto();
        dto.setId(user.getId());
        dto.setName(targetDisplayName(user));
        dto.setHandle(toHandle(user));
        dto.setEmail(user.getEmail());
        dto.setRole(normalizeRole(user.getRole()));
        dto.setStatus(safeUpper(user.getStatus(), "OFFLINE"));
        dto.setActive(Boolean.TRUE.equals(user.getActive()));
        return dto;
    }

    private void persistMessageMentions(CollaborationMessage message, String content) {
        Set<Long> mentioned = extractMentionUserIds(content);
        for (Long userId : mentioned) {
            User user = userRepository.findById(userId).orElse(null);
            if (user == null || !Boolean.TRUE.equals(user.getActive())) continue;
            CollaborationMessageMention mention = new CollaborationMessageMention();
            mention.setMessage(message);
            mention.setUser(user);
            messageMentionRepository.save(mention);
        }
    }

    private void persistMessageArticles(CollaborationMessage message, List<Long> linkedArticleIds) {
        Set<Long> articleIds = uniquePositiveIds(linkedArticleIds);
        for (Long articleId : articleIds) {
            CollaborationMessageArticle article = new CollaborationMessageArticle();
            article.setMessage(message);
            article.setArticleId(articleId);
            messageArticleRepository.save(article);
        }
    }

    private void removeDeletedIdsFromPreferences(List<Long> deletedMessageIds) {
        if (deletedMessageIds.isEmpty()) return;
        Set<String> deleted = deletedMessageIds.stream().map(String::valueOf).collect(Collectors.toSet());
        for (CollaborationUserPreference pref : preferenceRepository.findAll()) {
            ParsedPreference parsed = parsePreference(pref);
            boolean changed = parsed.savedMessageIds.removeIf(deleted::contains);
            if (changed) {
                persistPreference(pref, parsed);
            }
        }
    }

    private void collectMessageDescendants(
        Long messageId,
        Map<Long, List<CollaborationMessage>> childrenByParent,
        Set<Long> out
    ) {
        if (messageId == null || out.contains(messageId)) return;
        out.add(messageId);
        for (CollaborationMessage child : childrenByParent.getOrDefault(messageId, List.of())) {
            collectMessageDescendants(child.getId(), childrenByParent, out);
        }
    }

    private void touchRoom(CollaborationRoom room) {
        room.setUpdatedAt(LocalDateTime.now());
        roomRepository.save(room);
    }

    private CollaborationRoom getRoomForMember(User currentUser, Long roomId) {
        if (roomId == null || roomId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "roomId is invalid.");
        }
        CollaborationRoom room = roomRepository.findById(roomId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found."));
        if (Boolean.TRUE.equals(room.getArchived())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found.");
        }
        boolean hasAccess = roomMemberRepository.existsByRoomIdAndUserId(room.getId(), currentUser.getId())
            || (room.getOwnerUser() != null && Objects.equals(room.getOwnerUser().getId(), currentUser.getId()));
        if (!hasAccess) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied for this room.");
        }
        return room;
    }

    private CollaborationMessage getMessageForRoom(CollaborationRoom room, Long messageId) {
        if (messageId == null || messageId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "messageId is invalid.");
        }
        CollaborationMessage message = messageRepository.findById(messageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found."));
        if (!Objects.equals(message.getRoom().getId(), room.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message does not belong to room.");
        }
        return message;
    }

    private CollaborationUserPreference getOrCreatePreference(User user) {
        return preferenceRepository.findByUserId(user.getId()).orElseGet(() -> {
            CollaborationUserPreference pref = new CollaborationUserPreference();
            pref.setUser(user);
            pref.setStarredRoomIds("");
            pref.setMutedRoomIds("");
            pref.setSavedMessageIds("");
            pref.setLastReadByRoom("{}");
            return preferenceRepository.save(pref);
        });
    }

    private ParsedPreference parsePreference(CollaborationUserPreference pref) {
        ParsedPreference parsed = new ParsedPreference();
        parsed.starredRoomIds = parseCsvSet(pref.getStarredRoomIds());
        parsed.mutedRoomIds = parseCsvSet(pref.getMutedRoomIds());
        parsed.savedMessageIds = parseCsvSet(pref.getSavedMessageIds());
        parsed.lastReadAtByRoom = parseLastReadMap(pref.getLastReadByRoom());
        return parsed;
    }

    private void persistPreference(CollaborationUserPreference pref, ParsedPreference parsed) {
        pref.setStarredRoomIds(toCsv(parsed.starredRoomIds));
        pref.setMutedRoomIds(toCsv(parsed.mutedRoomIds));
        pref.setSavedMessageIds(toCsv(parsed.savedMessageIds));
        pref.setLastReadByRoom(toJson(parsed.lastReadAtByRoom));
        preferenceRepository.save(pref);
    }

    private CollaborationPreferencesDto toPreferencesDto(ParsedPreference parsed) {
        CollaborationPreferencesDto dto = new CollaborationPreferencesDto();
        dto.setStarredRoomIds(new ArrayList<>(parsed.starredRoomIds));
        dto.setMutedRoomIds(new ArrayList<>(parsed.mutedRoomIds));
        dto.setSavedMessageIds(new ArrayList<>(parsed.savedMessageIds));
        dto.setLastReadAtByRoom(new LinkedHashMap<>(parsed.lastReadAtByRoom));
        return dto;
    }

    private Set<String> parseCsvSet(String raw) {
        if (raw == null || raw.isBlank()) {
            return new LinkedHashSet<>();
        }
        Set<String> result = new LinkedHashSet<>();
        for (String token : raw.split(",")) {
            String cleaned = trimToEmpty(token);
            if (!cleaned.isBlank()) {
                result.add(cleaned);
            }
        }
        return result;
    }

    private String toCsv(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return "";
        }
        return values.stream()
            .map(this::trimToEmpty)
            .filter(value -> !value.isBlank())
            .collect(Collectors.joining(","));
    }

    private Map<String, String> parseLastReadMap(String raw) {
        if (raw == null || raw.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, String> parsed = objectMapper.readValue(raw, new TypeReference<Map<String, String>>() {});
            Map<String, String> cleaned = new LinkedHashMap<>();
            for (Map.Entry<String, String> entry : parsed.entrySet()) {
                String key = trimToEmpty(entry.getKey());
                String value = trimToEmpty(entry.getValue());
                if (!key.isBlank() && !value.isBlank()) {
                    cleaned.put(key, value);
                }
            }
            return cleaned;
        } catch (Exception ignored) {
            return new LinkedHashMap<>();
        }
    }

    private String toJson(Map<String, String> values) {
        try {
            return objectMapper.writeValueAsString(values == null ? Map.of() : values);
        } catch (Exception ignored) {
            return "{}";
        }
    }

    private LocalDateTime parseIsoLocalDateTime(String iso) {
        String value = trimToEmpty(iso);
        if (value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.ofInstant(java.time.Instant.parse(value), ZoneId.systemDefault());
        } catch (Exception ignored) {
            try {
                return LocalDateTime.parse(value);
            } catch (Exception ignoredToo) {
                return null;
            }
        }
    }

    private Set<Long> extractMentionUserIds(String content) {
        String text = trimToEmpty(content);
        if (text.isBlank()) {
            return new LinkedHashSet<>();
        }

        Map<String, Long> handleToUserId = userRepository.findAll().stream()
            .filter(user -> Boolean.TRUE.equals(user.getActive()))
            .collect(Collectors.toMap(
                user -> toHandle(user).toLowerCase(),
                User::getId,
                (left, right) -> left,
                LinkedHashMap::new
            ));

        Set<Long> mentionUserIds = new LinkedHashSet<>();
        Matcher matcher = MENTION_PATTERN.matcher(text);
        while (matcher.find()) {
            String handle = trimToEmpty(matcher.group(1)).toLowerCase();
            Long userId = handleToUserId.get(handle);
            if (userId != null && userId > 0) {
                mentionUserIds.add(userId);
            }
        }
        return mentionUserIds;
    }

    private void addRoomMember(CollaborationRoom room, User user) {
        if (roomMemberRepository.existsByRoomIdAndUserId(room.getId(), user.getId())) {
            return;
        }
        CollaborationRoomMember member = new CollaborationRoomMember();
        member.setRoom(room);
        member.setUser(user);
        roomMemberRepository.save(member);
    }

    private void createSystemMessage(CollaborationRoom room, User actor, String content) {
        CollaborationMessage message = new CollaborationMessage();
        message.setRoom(room);
        message.setSenderUser(actor);
        message.setKind("SYSTEM");
        message.setContent(trimToEmpty(content));
        message.setParentMessage(null);
        message.setPinned(false);
        messageRepository.save(message);
    }

    private User findActiveUser(Long userId) {
        if (userId == null || userId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid user id.");
        }
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is inactive.");
        }
        return user;
    }

    private void ensureAdmin(User user) {
        if (!isAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can perform this action.");
        }
    }

    private boolean isAdmin(User user) {
        return "ADMIN".equals(normalizeRole(user == null ? null : user.getRole()));
    }

    private String normalizeRole(String role) {
        String normalized = safeUpper(role, "");
        if (normalized.startsWith("ROLE_")) {
            normalized = normalized.substring(5);
        }
        if (normalized.equals("1")) {
            return "ADMIN";
        }
        if (normalized.isBlank()) {
            return "AGENT";
        }
        return normalized;
    }

    private String toHandle(User user) {
        String email = trimToEmpty(user == null ? null : user.getEmail());
        String fullName = trimToEmpty((user == null ? null : user.getFirstName()) + " " + (user == null ? null : user.getLastName()));
        String source = email.contains("@") ? email.substring(0, email.indexOf('@')) : fullName;
        String handle = source.toLowerCase()
            .replaceAll("[^a-z0-9._-]+", ".")
            .replaceAll("\\.+", ".")
            .replaceAll("^\\.|\\.$", "");
        return handle.isBlank() ? "user" + (user == null ? "" : user.getId()) : handle;
    }

    private String targetDisplayName(User user) {
        if (user == null) {
            return "Unknown user";
        }
        String fullName = trimToEmpty(user.getFirstName() + " " + user.getLastName());
        if (!fullName.isBlank()) {
            return fullName;
        }
        String email = trimToEmpty(user.getEmail());
        if (!email.isBlank()) {
            return email;
        }
        return "User " + user.getId();
    }

    private String normalizeChannelName(String raw) {
        String value = trimToEmpty(raw).toLowerCase();
        String cleaned = value
            .replaceAll("[^a-z0-9-_ ]+", "")
            .replaceAll("\\s+", "-")
            .replaceAll("-+", "-")
            .replaceAll("^-+|-+$", "");
        if (!cleaned.isBlank()) {
            return cleaned;
        }
        return "channel-" + System.currentTimeMillis();
    }

    private Set<Long> uniquePositiveIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new LinkedHashSet<>();
        }
        Set<Long> unique = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null && id > 0) {
                unique.add(id);
            }
        }
        return unique;
    }

    private Long parseStringId(String value) {
        String cleaned = trimToEmpty(value);
        if (cleaned.isBlank()) {
            return null;
        }
        try {
            Long parsed = Long.parseLong(cleaned);
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private CollaborationTypingDto buildTypingDto(CollaborationRoom room, User currentUser) {
        CollaborationTypingDto dto = new CollaborationTypingDto();
        dto.setTypingUserIds(listTypingUserIds(room, currentUser));
        return dto;
    }

    private List<Long> listTypingUserIds(CollaborationRoom room, User currentUser) {
        if (room == null) {
            return List.of();
        }
        Set<Long> allowedUserIds = roomMemberRepository.findByRoomId(room.getId()).stream()
            .map(member -> member.getUser() == null ? null : member.getUser().getId())
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        if (room.getOwnerUser() != null && room.getOwnerUser().getId() != null) {
            allowedUserIds.add(room.getOwnerUser().getId());
        }

        String prefix = room.getId() + ":";
        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(TYPING_TTL_SECONDS);
        Set<Long> typingUsers = new LinkedHashSet<>();
        for (Map.Entry<String, LocalDateTime> entry : typingState.entrySet()) {
            String key = trimToEmpty(entry.getKey());
            if (!key.startsWith(prefix)) continue;
            LocalDateTime touchedAt = entry.getValue();
            if (touchedAt == null || touchedAt.isBefore(cutoff)) continue;
            Long userId = parseTypingUserId(key);
            if (userId == null || !allowedUserIds.contains(userId)) continue;
            if (currentUser != null && Objects.equals(userId, currentUser.getId())) continue;
            typingUsers.add(userId);
        }
        return typingUsers.stream().sorted().toList();
    }

    private String buildTypingKey(Long roomId, Long userId) {
        return String.valueOf(roomId) + ":" + String.valueOf(userId);
    }

    private Long parseTypingUserId(String typingKey) {
        String key = trimToEmpty(typingKey);
        int separator = key.indexOf(':');
        if (separator < 0 || separator >= key.length() - 1) {
            return null;
        }
        try {
            Long parsed = Long.parseLong(key.substring(separator + 1));
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private void cleanupExpiredTyping() {
        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(TYPING_TTL_SECONDS);
        typingState.entrySet().removeIf(entry -> entry.getValue() == null || entry.getValue().isBefore(cutoff));
    }

    private String safeUpper(String value, String fallback) {
        String source = trimToEmpty(value);
        if (source.isBlank()) {
            source = trimToEmpty(fallback);
        }
        return source.isBlank() ? "" : source.toUpperCase();
    }

    private static class ParsedPreference {
        private Set<String> starredRoomIds = new LinkedHashSet<>();
        private Set<String> mutedRoomIds = new LinkedHashSet<>();
        private Set<String> savedMessageIds = new LinkedHashSet<>();
        private Map<String, String> lastReadAtByRoom = new LinkedHashMap<>();
    }
}
