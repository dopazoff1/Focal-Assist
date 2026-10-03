package com.focal.api.service;

import com.focal.api.dto.*;
import com.focal.api.models.*;
import com.focal.api.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;

@Service
public class ProcessAssistantService {

    private static final Set<String> SUPPORTED_ROLES = Set.of("AGENT", "ADMIN", "TEAM_LEADER", "QA", "HEAD_CS", "OPS");
    private static final Set<String> SUPPORTED_MESSAGE_ROLES = Set.of("user", "assistant", "system");
    private static final Set<String> SUPPORTED_AI_MODELS = Set.of("gpt-4o-mini", "gpt-4o");

    private final ProcessAssistantPromptProfileRepository promptProfileRepository;
    private final ProcessAssistantPromptRoleLinkRepository promptRoleLinkRepository;
    private final ProcessAssistantConversationRepository conversationRepository;
    private final ProcessAssistantMessageRepository messageRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${openai.api-key:}")
    private String openAiApiKey;

    @Value("${openai.chat-completions-url:https://api.openai.com/v1/chat/completions}")
    private String openAiCompletionsUrl;

    @Value("${openai.default-model:gpt-4o-mini}")
    private String defaultModel;

    public ProcessAssistantService(
        ProcessAssistantPromptProfileRepository promptProfileRepository,
        ProcessAssistantPromptRoleLinkRepository promptRoleLinkRepository,
        ProcessAssistantConversationRepository conversationRepository,
        ProcessAssistantMessageRepository messageRepository
    ) {
        this.promptProfileRepository = promptProfileRepository;
        this.promptRoleLinkRepository = promptRoleLinkRepository;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    @Transactional
    public ProcessAssistantPromptMapResponseDto getPromptMap() {
        ensurePromptDefaults();
        return buildPromptMapResponse(
            promptProfileRepository.findAllByOrderByIdAsc(),
            promptRoleLinkRepository.findAllByOrderByRoleAscPromptProfileIdAsc()
        );
    }

    @Transactional
    public ProcessAssistantPromptMapResponseDto savePromptMap(ProcessAssistantPromptMapSaveRequestDto request) {
        List<ProcessAssistantPromptProfileDto> incomingProfiles = request != null && request.getProfiles() != null
            ? request.getProfiles()
            : Collections.emptyList();
        List<ProcessAssistantPromptRoleLinkDto> incomingLinks = request != null && request.getLinks() != null
            ? request.getLinks()
            : Collections.emptyList();

        Set<Long> keepIds = new HashSet<>();
        Map<Long, ProcessAssistantPromptProfile> existingById = new HashMap<>();
        for (ProcessAssistantPromptProfile item : promptProfileRepository.findAllByOrderByIdAsc()) {
            existingById.put(item.getId(), item);
        }

        List<ProcessAssistantPromptProfile> toSave = new ArrayList<>();
        for (ProcessAssistantPromptProfileDto dto : incomingProfiles) {
            if (dto == null) continue;
            Long id = dto.getId();
            ProcessAssistantPromptProfile profile = id != null ? existingById.get(id) : null;
            if (profile == null) {
                profile = new ProcessAssistantPromptProfile();
            }
            profile.setName(trimToDefault(dto.getName(), "Prompt"));
            profile.setSystemPrompt(trimToDefault(dto.getSystemPrompt(), "You are Focal Process Copilot."));
            profile.setModel(normalizeModel(dto.getModel()));
            profile.setApiKey(normalizeApiKey(dto.getApiKey()));
            profile.setTemperature(clampDouble(dto.getTemperature(), 0d, 2d, 0.2d));
            profile.setMaxTokens(clampInt(dto.getMaxTokens(), 128, 4096, 900));
            profile.setActive(dto.getActive() == null || dto.getActive());
            profile.setXPos(dto.getXPos());
            profile.setYPos(dto.getYPos());
            toSave.add(profile);
        }

        List<ProcessAssistantPromptProfile> savedProfiles = promptProfileRepository.saveAll(toSave);
        keepIds.addAll(savedProfiles.stream().map(ProcessAssistantPromptProfile::getId).toList());

        List<ProcessAssistantPromptProfile> allCurrent = promptProfileRepository.findAllByOrderByIdAsc();
        for (ProcessAssistantPromptProfile profile : allCurrent) {
            if (!keepIds.contains(profile.getId())) {
                promptProfileRepository.delete(profile);
            }
        }

        Set<Long> validProfileIds = new HashSet<>(promptProfileRepository.findAllByOrderByIdAsc().stream().map(ProcessAssistantPromptProfile::getId).toList());
        List<ProcessAssistantPromptRoleLink> linkEntities = new ArrayList<>();
        Set<String> dedupe = new HashSet<>();
        for (ProcessAssistantPromptRoleLinkDto linkDto : incomingLinks) {
            if (linkDto == null) continue;
            String role = normalizeAppRole(linkDto.getRole());
            if (role == null) continue;
            Long profileId = linkDto.getPromptProfileId();
            if (profileId == null || !validProfileIds.contains(profileId)) continue;
            String key = role + ":" + profileId;
            if (!dedupe.add(key)) continue;

            ProcessAssistantPromptRoleLink link = new ProcessAssistantPromptRoleLink();
            link.setRole(role);
            link.setPromptProfileId(profileId);
            linkEntities.add(link);
        }

        promptRoleLinkRepository.deleteAllInBatch();
        if (!linkEntities.isEmpty()) {
            promptRoleLinkRepository.saveAll(linkEntities);
        }

        // Keep conversations coherent if a prompt profile was removed.
        List<ProcessAssistantConversation> allConversations = conversationRepository.findAll();
        for (ProcessAssistantConversation conversation : allConversations) {
            if (conversation.getPromptProfileId() != null && !validProfileIds.contains(conversation.getPromptProfileId())) {
                conversation.setPromptProfileId(null);
            }
        }
        if (!allConversations.isEmpty()) {
            conversationRepository.saveAll(allConversations);
        }

        ensurePromptDefaults();
        return buildPromptMapResponse(
            promptProfileRepository.findAllByOrderByIdAsc(),
            promptRoleLinkRepository.findAllByOrderByRoleAscPromptProfileIdAsc()
        );
    }

    @Transactional(readOnly = true)
    public List<ProcessAssistantConversationDto> listConversations(User user) {
        List<ProcessAssistantConversation> rows = conversationRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
        return rows.stream().map(this::toConversationDto).toList();
    }

    @Transactional
    public ProcessAssistantConversationDto createConversation(User user, ProcessAssistantCreateConversationRequestDto request) {
        ProcessAssistantConversation conversation = new ProcessAssistantConversation();
        conversation.setUser(user);
        conversation.setTitle(trimToDefault(request == null ? null : request.getTitle(), "New conversation"));
        conversation.setPromptProfileId(request == null ? null : request.getPromptProfileId());
        conversation.setLastMessagePreview("");
        ProcessAssistantConversation saved = conversationRepository.save(conversation);
        return toConversationDto(saved);
    }

    @Transactional
    public void deleteConversation(User user, Long conversationId) {
        ProcessAssistantConversation conversation = findOwnedConversation(user, conversationId);
        conversationRepository.delete(conversation);
    }

    @Transactional
    public ProcessAssistantConversationDto setConversationPrompt(User user, Long conversationId, Long promptProfileId) {
        ProcessAssistantConversation conversation = findOwnedConversation(user, conversationId);
        conversation.setPromptProfileId(promptProfileId);
        ProcessAssistantConversation saved = conversationRepository.save(conversation);
        return toConversationDto(saved);
    }

    @Transactional(readOnly = true)
    public List<ProcessAssistantMessageDto> listMessages(User user, Long conversationId) {
        ProcessAssistantConversation conversation = findOwnedConversation(user, conversationId);
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversation.getId())
            .stream()
            .map(this::toMessageDto)
            .toList();
    }

    @Transactional
    public ProcessAssistantSendMessageResponseDto sendMessage(
        User user,
        Long conversationId,
        ProcessAssistantSendMessageRequestDto request
    ) {
        if (request == null || request.getText() == null || request.getText().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message text is required");
        }

        ProcessAssistantConversation conversation = findOwnedConversation(user, conversationId);
        String text = request.getText().trim();
        Long requestedPromptProfileId = request.getPromptProfileId();

        if (requestedPromptProfileId != null) {
            conversation.setPromptProfileId(requestedPromptProfileId);
        }

        ProcessAssistantMessage userMessage = new ProcessAssistantMessage();
        userMessage.setConversation(conversation);
        userMessage.setRole("user");
        userMessage.setContent(text);
        userMessage.setModel(null);
        messageRepository.save(userMessage);

        ProcessAssistantPromptProfile profile = resolveConversationPromptProfile(conversation, user);
        if (profile == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No prompt profile is configured.");
        }
        String resolvedApiKey = normalizeApiKey(profile.getApiKey());
        if (resolvedApiKey == null) {
            resolvedApiKey = normalizeApiKey(openAiApiKey);
        }
        if (resolvedApiKey == null) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "No OpenAI API key configured for selected prompt (id=" + profile.getId() + ", name=" + profile.getName() + ")."
            );
        }

        String assistantText = generateAssistantReply(conversation, profile, text, resolvedApiKey);

        ProcessAssistantMessage assistantMessage = new ProcessAssistantMessage();
        assistantMessage.setConversation(conversation);
        assistantMessage.setRole("assistant");
        assistantMessage.setContent(assistantText);
        assistantMessage.setModel(profile.getModel());
        messageRepository.save(assistantMessage);

        if ("New conversation".equalsIgnoreCase(conversation.getTitle())) {
            conversation.setTitle(buildConversationTitle(text));
        }
        conversation.setPromptProfileId(profile.getId());
        conversation.setLastMessagePreview(shortPreview(assistantText));
        conversationRepository.save(conversation);

        ProcessAssistantSendMessageResponseDto response = new ProcessAssistantSendMessageResponseDto();
        response.setConversation(toConversationDto(conversation));
        response.setMessages(messageRepository.findByConversationIdOrderByCreatedAtAsc(conversation.getId())
            .stream()
            .map(this::toMessageDto)
            .toList());
        return response;
    }

    @Transactional(readOnly = true)
    public ProcessAssistantRespondResponseDto respond(ProcessAssistantRespondRequestDto request) {
        String model = normalizeModel(request == null ? null : request.getModel());
        double temperature = clampDouble(request == null ? null : request.getTemperature(), 0d, 2d, 0.2d);
        int maxTokens = clampInt(request == null ? null : request.getMaxTokens(), 128, 4096, 900);
        String systemPrompt = request == null ? "" : trimToDefault(request.getSystemPrompt(), "");

        List<Map<String, String>> messages = new ArrayList<>();
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            messages.add(Map.of("role", "system", "content", systemPrompt));
        }
        if (request != null && request.getMessages() != null) {
            for (ProcessAssistantRespondMessageDto item : request.getMessages()) {
                if (item == null) continue;
                String role = (item.getRole() == null ? "" : item.getRole().trim().toLowerCase(Locale.ROOT));
                String content = item.getContent() == null ? "" : item.getContent();
                if (!SUPPORTED_MESSAGE_ROLES.contains(role) || content.isBlank()) continue;
                messages.add(Map.of("role", role, "content", content));
            }
        }
        if (messages.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No messages provided");
        }

        String content = callOpenAi(model, temperature, maxTokens, messages, null);
        return new ProcessAssistantRespondResponseDto(content);
    }

    private String generateAssistantReply(
        ProcessAssistantConversation conversation,
        ProcessAssistantPromptProfile profile,
        String userText,
        String resolvedApiKey
    ) {
        List<ProcessAssistantMessage> latestDesc = messageRepository.findTop40ByConversationIdOrderByCreatedAtDesc(conversation.getId());
        List<ProcessAssistantMessage> history = new ArrayList<>(latestDesc);
        Collections.reverse(history);

        List<Map<String, String>> messages = new ArrayList<>();
        if (profile.getSystemPrompt() != null && !profile.getSystemPrompt().isBlank()) {
            messages.add(Map.of("role", "system", "content", profile.getSystemPrompt()));
        }

        for (ProcessAssistantMessage item : history) {
            String role = item.getRole() == null ? "" : item.getRole().trim().toLowerCase(Locale.ROOT);
            if (!SUPPORTED_MESSAGE_ROLES.contains(role)) continue;
            if (item.getContent() == null || item.getContent().isBlank()) continue;
            messages.add(Map.of("role", role, "content", item.getContent()));
        }

        // Failsafe if history query somehow missed the current message.
        if (messages.stream().noneMatch(m -> "user".equals(m.get("role")) && userText.equals(m.get("content")))) {
            messages.add(Map.of("role", "user", "content", userText));
        }

        return callOpenAi(
            normalizeModel(profile.getModel()),
            clampDouble(profile.getTemperature(), 0d, 2d, 0.2d),
            clampInt(profile.getMaxTokens(), 128, 4096, 900),
            messages,
            resolvedApiKey
        );
    }

    private String callOpenAi(
        String model,
        double temperature,
        int maxTokens,
        List<Map<String, String>> messages,
        String promptLevelApiKey
    ) {
        String apiKey = normalizeApiKey(promptLevelApiKey);
        if (apiKey == null) {
            apiKey = normalizeApiKey(openAiApiKey);
        }
        if (apiKey == null) {
            throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "OpenAI API key is not configured on backend (openai.api-key or prompt profile apiKey)."
            );
        }
        if (!looksLikeOpenAiApiKey(apiKey)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Configured OpenAI API key format is invalid for selected prompt (expected key starting with sk-)."
            );
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("temperature", temperature);
        payload.put("max_tokens", maxTokens);
        payload.put("messages", messages);

        try {
            String json = objectMapper.writeValueAsString(payload);
            HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(openAiCompletionsUrl))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() >= 400) {
                String detail = extractErrorMessage(response.body());
                int upstreamStatus = response.statusCode();
                HttpStatus mappedStatus = HttpStatus.BAD_GATEWAY;
                if (upstreamStatus == 401 || upstreamStatus == 403) {
                    mappedStatus = HttpStatus.BAD_REQUEST;
                } else if (upstreamStatus == 429) {
                    mappedStatus = HttpStatus.TOO_MANY_REQUESTS;
                }
                throw new ResponseStatusException(
                    mappedStatus,
                    "OpenAI request failed (" + upstreamStatus + ")" + (detail.isBlank() ? "" : ": " + detail)
                );
            }

            JsonNode root = objectMapper.readTree(response.body());
            String content = root.path("choices").path(0).path("message").path("content").asText("");
            if (content == null || content.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OpenAI returned an empty response.");
            }
            return content.trim();
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to call OpenAI: " + ex.getMessage());
        }
    }

    private String extractErrorMessage(String body) {
        try {
            JsonNode root = objectMapper.readTree(body);
            String msg = root.path("error").path("message").asText("");
            return msg == null ? "" : msg.trim();
        } catch (Exception ignored) {
            return "";
        }
    }

    private ProcessAssistantConversation findOwnedConversation(User user, Long conversationId) {
        if (conversationId == null || conversationId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "conversationId is invalid");
        }
        return conversationRepository.findByIdAndUserId(conversationId, user.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
    }

    private ProcessAssistantPromptProfile resolveConversationPromptProfile(ProcessAssistantConversation conversation, User user) {
        String globalApiKey = normalizeApiKey(openAiApiKey);
        boolean mustPreferPromptApiKey = globalApiKey == null;

        if (conversation.getPromptProfileId() != null) {
            Optional<ProcessAssistantPromptProfile> byConversation = promptProfileRepository.findById(conversation.getPromptProfileId());
            if (byConversation.isPresent()) {
                ProcessAssistantPromptProfile profile = byConversation.get();
                if (
                    Boolean.TRUE.equals(profile.getActive()) &&
                    (!mustPreferPromptApiKey || normalizeApiKey(profile.getApiKey()) != null)
                ) {
                    return profile;
                }
            }
        }

        String role = normalizeAppRole(user.getRole());
        List<ProcessAssistantPromptRoleLink> links = promptRoleLinkRepository.findAllByOrderByRoleAscPromptProfileIdAsc();
        for (ProcessAssistantPromptRoleLink link : links) {
            if (role != null && role.equals(link.getRole())) {
                Optional<ProcessAssistantPromptProfile> profile = promptProfileRepository.findById(link.getPromptProfileId());
                if (profile.isPresent()) {
                    ProcessAssistantPromptProfile item = profile.get();
                    if (
                        Boolean.TRUE.equals(item.getActive()) &&
                        (!mustPreferPromptApiKey || normalizeApiKey(item.getApiKey()) != null)
                    ) {
                        return item;
                    }
                }
            }
        }

        Optional<ProcessAssistantPromptProfile> anyActiveWithKey = promptProfileRepository.findAllByOrderByIdAsc()
            .stream()
            .filter(item -> Boolean.TRUE.equals(item.getActive()))
            .filter(item -> normalizeApiKey(item.getApiKey()) != null)
            .findFirst();

        if (anyActiveWithKey.isPresent()) {
            return anyActiveWithKey.get();
        }

        return promptProfileRepository.findAllByOrderByIdAsc()
            .stream()
            .filter(item -> Boolean.TRUE.equals(item.getActive()))
            .findFirst()
            .orElse(null);
    }

    private ProcessAssistantPromptMapResponseDto buildPromptMapResponse(
        List<ProcessAssistantPromptProfile> profiles,
        List<ProcessAssistantPromptRoleLink> links
    ) {
        ProcessAssistantPromptMapResponseDto response = new ProcessAssistantPromptMapResponseDto();

        List<ProcessAssistantPromptProfileDto> profileDtos = profiles.stream().map(this::toPromptProfileDto).toList();
        List<ProcessAssistantPromptRoleLinkDto> linkDtos = links.stream().map(this::toPromptLinkDto).toList();

        response.setProfiles(profileDtos);
        response.setLinks(linkDtos);
        return response;
    }

    private ProcessAssistantPromptProfileDto toPromptProfileDto(ProcessAssistantPromptProfile item) {
        ProcessAssistantPromptProfileDto dto = new ProcessAssistantPromptProfileDto();
        dto.setId(item.getId());
        dto.setName(item.getName());
        dto.setSystemPrompt(item.getSystemPrompt());
        dto.setModel(item.getModel());
        dto.setApiKey(item.getApiKey());
        dto.setTemperature(item.getTemperature());
        dto.setMaxTokens(item.getMaxTokens());
        dto.setActive(item.getActive());
        dto.setXPos(item.getXPos());
        dto.setYPos(item.getYPos());
        dto.setCreatedAt(formatDate(item.getCreatedAt()));
        dto.setUpdatedAt(formatDate(item.getUpdatedAt()));
        return dto;
    }

    private ProcessAssistantPromptRoleLinkDto toPromptLinkDto(ProcessAssistantPromptRoleLink item) {
        ProcessAssistantPromptRoleLinkDto dto = new ProcessAssistantPromptRoleLinkDto();
        dto.setRole(item.getRole());
        dto.setPromptProfileId(item.getPromptProfileId());
        return dto;
    }

    private ProcessAssistantConversationDto toConversationDto(ProcessAssistantConversation item) {
        ProcessAssistantConversationDto dto = new ProcessAssistantConversationDto();
        dto.setId(item.getId() == null ? "" : String.valueOf(item.getId()));
        dto.setUserId(item.getUser() == null ? null : item.getUser().getId());
        dto.setTitle(item.getTitle());
        dto.setPromptProfileId(item.getPromptProfileId());
        dto.setCreatedAt(formatDate(item.getCreatedAt()));
        dto.setUpdatedAt(formatDate(item.getUpdatedAt()));
        dto.setLastMessagePreview(item.getLastMessagePreview() == null ? "" : item.getLastMessagePreview());
        return dto;
    }

    private ProcessAssistantMessageDto toMessageDto(ProcessAssistantMessage item) {
        ProcessAssistantMessageDto dto = new ProcessAssistantMessageDto();
        dto.setId(item.getId() == null ? "" : String.valueOf(item.getId()));
        dto.setConversationId(item.getConversation() == null || item.getConversation().getId() == null
            ? ""
            : String.valueOf(item.getConversation().getId()));
        dto.setRole(item.getRole());
        dto.setContent(item.getContent());
        dto.setCreatedAt(formatDate(item.getCreatedAt()));
        dto.setModel(item.getModel());
        return dto;
    }

    private String normalizeAppRole(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String role = raw.trim().toUpperCase(Locale.ROOT).replace("ROLE_", "");
        if ("1".equals(role)) return "ADMIN";
        if ("2".equals(role)) return "AGENT";
        if ("HEAD_OF_CS".equals(role)) return "HEAD_CS";
        if ("ROLE_HEAD_OF_CS".equals(role)) return "HEAD_CS";
        if ("ROLE_HEAD_CS".equals(role)) return "HEAD_CS";
        if (SUPPORTED_ROLES.contains(role)) return role;
        return null;
    }

    private String normalizeModel(String raw) {
        String model = raw == null || raw.isBlank() ? defaultModel : raw.trim();
        if (!SUPPORTED_AI_MODELS.contains(model)) {
            return defaultModel;
        }
        return model;
    }

    private Double clampDouble(Double value, double min, double max, double fallback) {
        if (value == null || value.isNaN() || value.isInfinite()) return fallback;
        return Math.max(min, Math.min(max, value));
    }

    private Integer clampInt(Integer value, int min, int max, int fallback) {
        if (value == null) return fallback;
        return Math.max(min, Math.min(max, value));
    }

    private String trimToDefault(String value, String fallback) {
        String v = value == null ? "" : value.trim();
        if (v.isBlank()) return fallback;
        return v;
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private String normalizeApiKey(String value) {
        String key = trimToNull(value);
        if (key == null) return null;
        if (key.regionMatches(true, 0, "Bearer ", 0, 7)) {
            key = trimToNull(key.substring(7));
        }
        return key;
    }

    private boolean looksLikeOpenAiApiKey(String value) {
        return value != null && value.startsWith("sk-");
    }

    private String shortPreview(String value) {
        String text = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        if (text.length() <= 160) return text;
        return text.substring(0, 160);
    }

    private String buildConversationTitle(String userMessage) {
        String text = userMessage == null ? "" : userMessage.trim().replaceAll("\\s+", " ");
        if (text.isBlank()) return "New conversation";
        if (text.length() > 56) {
            return text.substring(0, 56) + "...";
        }
        return text;
    }

    private String formatDate(LocalDateTime value) {
        if (value == null) return "";
        return value.atZone(ZoneId.systemDefault()).toInstant().toString();
    }

    private void ensurePromptDefaults() {
        if (promptProfileRepository.count() > 0) {
            return;
        }

        ProcessAssistantPromptProfile p1 = new ProcessAssistantPromptProfile();
        p1.setName("Agent Process Coach");
        p1.setSystemPrompt("You are Focal Process Coach. Give concise, practical SOP guidance to support agents.");
        p1.setModel(normalizeModel(defaultModel));
        p1.setTemperature(0.2d);
        p1.setMaxTokens(800);
        p1.setActive(true);
        p1.setXPos(560);
        p1.setYPos(120);

        ProcessAssistantPromptProfile p2 = new ProcessAssistantPromptProfile();
        p2.setName("QA & TL Reviewer");
        p2.setSystemPrompt("You are Focal QA reviewer. Evaluate quality and suggest corrections with clear criteria.");
        p2.setModel(normalizeModel(defaultModel));
        p2.setTemperature(0.15d);
        p2.setMaxTokens(900);
        p2.setActive(true);
        p2.setXPos(560);
        p2.setYPos(300);

        ProcessAssistantPromptProfile p3 = new ProcessAssistantPromptProfile();
        p3.setName("Operations Strategist");
        p3.setSystemPrompt("You are Focal Operations strategist. Provide structured recommendations for leadership.");
        p3.setModel(normalizeModel(defaultModel));
        p3.setTemperature(0.1d);
        p3.setMaxTokens(1000);
        p3.setActive(true);
        p3.setXPos(560);
        p3.setYPos(480);

        promptProfileRepository.saveAll(List.of(p1, p2, p3));

        List<ProcessAssistantPromptProfile> saved = promptProfileRepository.findAllByOrderByIdAsc();
        if (saved.size() < 3) {
            return;
        }

        ProcessAssistantPromptRoleLink l1 = new ProcessAssistantPromptRoleLink();
        l1.setRole("AGENT");
        l1.setPromptProfileId(saved.get(0).getId());

        ProcessAssistantPromptRoleLink l2 = new ProcessAssistantPromptRoleLink();
        l2.setRole("TEAM_LEADER");
        l2.setPromptProfileId(saved.get(1).getId());

        ProcessAssistantPromptRoleLink l3 = new ProcessAssistantPromptRoleLink();
        l3.setRole("QA");
        l3.setPromptProfileId(saved.get(1).getId());

        ProcessAssistantPromptRoleLink l4 = new ProcessAssistantPromptRoleLink();
        l4.setRole("ADMIN");
        l4.setPromptProfileId(saved.get(2).getId());

        ProcessAssistantPromptRoleLink l5 = new ProcessAssistantPromptRoleLink();
        l5.setRole("HEAD_CS");
        l5.setPromptProfileId(saved.get(2).getId());

        ProcessAssistantPromptRoleLink l6 = new ProcessAssistantPromptRoleLink();
        l6.setRole("OPS");
        l6.setPromptProfileId(saved.get(2).getId());

        promptRoleLinkRepository.saveAll(List.of(l1, l2, l3, l4, l5, l6));
    }
}

