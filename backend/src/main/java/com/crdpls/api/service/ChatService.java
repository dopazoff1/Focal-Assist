package com.crdpls.api.service;

import com.crdpls.api.dto.ChatChannelDto;
import com.crdpls.api.dto.ChatConversationDto;
import com.crdpls.api.dto.ChatInboundMessageRequestDto;
import com.crdpls.api.dto.ChatLinkRequestDto;
import com.crdpls.api.dto.ChatMessageDto;
import com.crdpls.api.dto.ChatOauthStartDto;
import com.crdpls.api.dto.ChatReplyRequestDto;
import com.crdpls.api.dto.ChatWidgetConfigDto;
import com.crdpls.api.dto.ChatWidgetConfigRequestDto;
import com.crdpls.api.dto.ChatWidgetInboundRequestDto;
import com.crdpls.api.models.ChatChannelLink;
import com.crdpls.api.models.ChatConversation;
import com.crdpls.api.models.ChatMessage;
import com.crdpls.api.models.ChatWidgetConfig;
import com.crdpls.api.models.User;
import com.crdpls.api.repository.ChatChannelLinkRepository;
import com.crdpls.api.repository.ChatConversationRepository;
import com.crdpls.api.repository.ChatMessageRepository;
import com.crdpls.api.repository.ChatWidgetConfigRepository;
import com.crdpls.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ChatService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ChatChannelLinkRepository channelRepository;
    private final ChatConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatWidgetConfigRepository widgetConfigRepository;
    private final UserRepository userRepository;

    private final Map<String, OAuthState> oauthStates = new ConcurrentHashMap<>();

    @Value("${chat.meta.app-id:}")
    private String metaAppId;

    @Value("${chat.meta.redirect-uri:http://localhost:8080/api/crm/chats/oauth/callback}")
    private String metaRedirectUri;

    @Value("${chat.meta.oauth-url:https://www.facebook.com/v21.0/dialog/oauth}")
    private String metaOauthUrl;

    @Value("${chat.meta.scopes:business_management,pages_show_list,pages_messaging,instagram_basic,instagram_manage_messages,whatsapp_business_management,whatsapp_business_messaging}")
    private String metaScopes;

    @Value("${chat.meta.verify-token:}")
    private String metaVerifyToken;

    @Value("${chat.public-base-url:http://localhost:8080}")
    private String publicBaseUrl;

    public ChatService(
        ChatChannelLinkRepository channelRepository,
        ChatConversationRepository conversationRepository,
        ChatMessageRepository messageRepository,
        ChatWidgetConfigRepository widgetConfigRepository,
        UserRepository userRepository
    ) {
        this.channelRepository = channelRepository;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.widgetConfigRepository = widgetConfigRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public List<ChatChannelDto> listChannels(Long userId) {
        User user = ensureUser(userId);
        ensureDefaultChannels(user);
        return channelRepository.findByUserIdOrderByChannelTypeAsc(userId)
            .stream()
            .map(this::toChannelDto)
            .toList();
    }

    @Transactional
    public ChatOauthStartDto startOAuth(Long userId, String channelType) {
        User user = ensureUser(userId);
        String normalizedChannel = normalizeSocialChannel(channelType);
        ensureDefaultChannels(user);

        cleanupOauthStates();

        String state = UUID.randomUUID().toString().replace("-", "") + "." + userId + "." + normalizedChannel;
        oauthStates.put(state, new OAuthState(userId, normalizedChannel, LocalDateTime.now().plusMinutes(10)));

        String authUrl;
        if (isBlank(metaAppId)) {
            authUrl = metaRedirectUri
                + "?state=" + urlEncode(state)
                + "&code=dev-local-link";
        } else {
            authUrl = metaOauthUrl
                + "?client_id=" + urlEncode(metaAppId)
                + "&redirect_uri=" + urlEncode(metaRedirectUri)
                + "&response_type=code"
                + "&scope=" + urlEncode(metaScopes)
                + "&state=" + urlEncode(state);
        }

        ChatOauthStartDto dto = new ChatOauthStartDto();
        dto.setState(state);
        dto.setAuthUrl(authUrl);
        return dto;
    }

    @Transactional
    public ChatChannelDto completeOAuth(String state, String code, String error) {
        if (!isBlank(error)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OAuth failed: " + error);
        }
        if (isBlank(state)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing OAuth state");
        }
        if (isBlank(code)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing OAuth code");
        }

        cleanupOauthStates();
        OAuthState oauthState = oauthStates.remove(state);
        if (oauthState == null || oauthState.expiresAt().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OAuth session expired. Start again.");
        }

        String nextHandle = "whatsapp".equals(oauthState.channelType())
            ? "WhatsApp Business Linked"
            : "Instagram Business Linked";

        return linkChannel(oauthState.userId(), oauthState.channelType(), new ChatLinkRequestDto(nextHandle));
    }

    @Transactional
    public ChatChannelDto linkChannel(Long userId, String channelType, ChatLinkRequestDto request) {
        User user = ensureUser(userId);
        String normalizedChannel = normalizeChannel(channelType);
        String defaultHandle = defaultHandle(normalizedChannel);
        String nextHandle = request == null || isBlank(request.handle()) ? defaultHandle : request.handle().trim();

        ChatChannelLink channel = channelRepository.findByUserIdAndChannelType(userId, normalizedChannel)
            .orElseGet(() -> {
                ChatChannelLink created = new ChatChannelLink();
                created.setUser(user);
                created.setChannelType(normalizedChannel);
                return created;
            });

        channel.setHandle(nextHandle);
        channel.setConnected(true);
        channel.setLastSyncAt(LocalDateTime.now());
        return toChannelDto(channelRepository.save(channel));
    }

    @Transactional
    public ChatChannelDto unlinkChannel(Long userId, String channelType) {
        ensureUser(userId);
        String normalizedChannel = normalizeChannel(channelType);
        ChatChannelLink channel = channelRepository.findByUserIdAndChannelType(userId, normalizedChannel)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));
        channel.setConnected(false);
        channel.setLastSyncAt(null);
        return toChannelDto(channelRepository.save(channel));
    }

    @Transactional(readOnly = true)
    public List<ChatConversationDto> listConversations(Long userId) {
        User requester = ensureUser(userId);
        String role = normalizeRole(requester.getRole());

        List<ChatConversation> conversations;
        if ("AGENT".equals(role)) {
            conversations = conversationRepository.findAssignedToUser(userId);
        } else {
            conversations = conversationRepository.findAllLatestFirst();
        }

        return conversations.stream()
            .sorted(Comparator.comparing(ChatConversation::getLastMessageAt).reversed())
            .map(this::toConversationDto)
            .toList();
    }

    @Transactional
    public List<ChatMessageDto> getMessages(Long userId, Long conversationId) {
        User requester = ensureUser(userId);
        ChatConversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        ensureAccess(requester, conversation);

        if (conversation.getAssignedUser() != null && conversation.getAssignedUser().getId().equals(userId)) {
            conversation.setUnreadCount(0);
            conversationRepository.save(conversation);
        }

        return messageRepository.findByConversationIdOrderBySentAtAsc(conversationId)
            .stream()
            .map(this::toMessageDto)
            .toList();
    }

    @Transactional
    public ChatMessageDto sendReply(Long userId, Long conversationId, ChatReplyRequestDto request) {
        User requester = ensureUser(userId);
        ChatConversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        ensureAccess(requester, conversation);

        if (request == null || isBlank(request.text())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reply text is required");
        }

        String senderName = buildUserName(requester);
        ChatMessage saved = saveMessage(conversation, "agent", senderName, request.text().trim());

        conversation.setStatus("pending");
        conversation.setLastMessageAt(saved.getSentAt());
        conversation.setUnreadCount(0);
        conversationRepository.save(conversation);

        return toMessageDto(saved);
    }

    @Transactional
    public ChatConversationDto ingestInboundMessage(ChatInboundMessageRequestDto request) {
        if (request == null || isBlank(request.channel()) || isBlank(request.customerHandle()) || isBlank(request.text())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "channel, customerHandle and text are required");
        }

        String channel = normalizeChannel(request.channel());
        String externalThreadId = isBlank(request.externalThreadId())
            ? channel + ":" + request.customerHandle().trim().toLowerCase(Locale.ROOT)
            : request.externalThreadId().trim();

        ChatConversation conversation = conversationRepository
            .findByExternalThreadIdAndChannelType(externalThreadId, channel)
            .orElseGet(() -> {
                ChatConversation created = new ChatConversation();
                created.setChannelType(channel);
                created.setExternalThreadId(externalThreadId);
                created.setCustomerName(isBlank(request.customerName()) ? "Customer" : request.customerName().trim());
                created.setCustomerHandle(request.customerHandle().trim());
                created.setStatus("open");
                created.setUnreadCount(0);
                created.setAssignedUser(pickFairOnlineAgent());
                return created;
            });

        if (conversation.getAssignedUser() == null) {
            conversation.setAssignedUser(pickFairOnlineAgent());
        }

        ChatMessage saved = saveMessage(
            conversation,
            "customer",
            isBlank(request.customerName()) ? "Customer" : request.customerName().trim(),
            request.text().trim()
        );

        conversation.setStatus("open");
        conversation.setLastMessageAt(saved.getSentAt());
        conversation.setUnreadCount((conversation.getUnreadCount() == null ? 0 : conversation.getUnreadCount()) + 1);
        conversationRepository.save(conversation);

        return toConversationDto(conversation);
    }

    @Transactional(readOnly = true)
    public ChatWidgetConfigDto getWidgetConfig(Long userId) {
        User user = ensureUser(userId);
        ChatWidgetConfig config = ensureWidgetConfig(user);
        return toWidgetDto(config);
    }

    @Transactional
    public ChatWidgetConfigDto updateWidgetConfig(Long userId, ChatWidgetConfigRequestDto request) {
        User user = ensureUser(userId);
        ChatWidgetConfig config = ensureWidgetConfig(user);
        if (request != null) {
            if (!isBlank(request.websiteName())) {
                config.setWebsiteName(request.websiteName().trim());
            }
            if (request.enabled() != null) {
                config.setEnabled(request.enabled());
            }
        }
        return toWidgetDto(widgetConfigRepository.save(config));
    }

    @Transactional(readOnly = true)
    public String buildWidgetLoaderScript(String widgetToken) {
        ChatWidgetConfig config = widgetConfigRepository.findByWidgetToken(widgetToken)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Widget not found"));

        if (!Boolean.TRUE.equals(config.getEnabled())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Widget disabled");
        }

        String endpoint = safeJsString(buildPublicUrl("/api/crm/chats/widget/" + config.getWidgetToken() + "/inbound"));
        String appName = safeJsString(config.getWebsiteName());
        String token = safeJsString(config.getWidgetToken());

        return "(function(){\n"
            + "  if(window.__focalWidgetLoaded){return;} window.__focalWidgetLoaded=true;\n"
            + "  var endpoint='" + endpoint + "';\n"
            + "  var appName='" + appName + "';\n"
            + "  var token='" + token + "';\n"
            + "  var root=document.createElement('div');\n"
            + "  root.style.cssText='position:fixed;right:18px;bottom:18px;z-index:2147483000;font-family:Inter,Segoe UI,Arial,sans-serif;';\n"
            + "  var button=document.createElement('button');\n"
            + "  button.type='button'; button.textContent='Chat with '+appName;\n"
            + "  button.style.cssText='background:#0f62fe;color:#fff;border:0;border-radius:999px;padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgba(15,98,254,.3)';\n"
            + "  var panel=document.createElement('div');\n"
            + "  panel.style.cssText='display:none;width:320px;max-width:calc(100vw - 24px);background:#fff;border:1px solid #d1d5db;border-radius:12px;box-shadow:0 16px 40px rgba(15,23,42,.22);margin-top:10px;overflow:hidden';\n"
            + "  panel.innerHTML='<div style=\"padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#f8fafc;font-weight:700;font-size:13px\">'+appName+' Support</div>' +\n"
            + "    '<div style=\"padding:10px;display:grid;gap:8px\">' +\n"
            + "    '<input id=\"focal_name\" placeholder=\"Your name\" style=\"border:1px solid #d1d5db;border-radius:8px;padding:8px;font:inherit\" />' +\n"
            + "    '<input id=\"focal_handle\" placeholder=\"Email or phone (optional)\" style=\"border:1px solid #d1d5db;border-radius:8px;padding:8px;font:inherit\" />' +\n"
            + "    '<textarea id=\"focal_msg\" rows=\"4\" placeholder=\"Write your message...\" style=\"border:1px solid #d1d5db;border-radius:8px;padding:8px;font:inherit;resize:vertical\"></textarea>' +\n"
            + "    '<button id=\"focal_send\" type=\"button\" style=\"background:#0f62fe;color:#fff;border:0;border-radius:8px;padding:9px 12px;font-size:13px;font-weight:700;cursor:pointer\">Send</button>' +\n"
            + "    '<small id=\"focal_status\" style=\"color:#64748b\"></small>' +\n"
            + "    '</div>';\n"
            + "  button.addEventListener('click', function(){ panel.style.display = panel.style.display==='none'?'block':'none'; });\n"
            + "  setTimeout(function(){ var n=panel.querySelector('#focal_name'); if(n){n.value=localStorage.getItem('focal_chat_name')||'';} var h=panel.querySelector('#focal_handle'); if(h){h.value=localStorage.getItem('focal_chat_handle')||'';} },0);\n"
            + "  panel.addEventListener('click', function(ev){ var t=ev.target; if(t && t.id==='focal_send'){\n"
            + "    var name=(panel.querySelector('#focal_name').value||'').trim();\n"
            + "    var handle=(panel.querySelector('#focal_handle').value||'').trim();\n"
            + "    var text=(panel.querySelector('#focal_msg').value||'').trim();\n"
            + "    var status=panel.querySelector('#focal_status');\n"
            + "    if(!text){ status.textContent='Please enter a message.'; return; }\n"
            + "    localStorage.setItem('focal_chat_name', name); localStorage.setItem('focal_chat_handle', handle);\n"
            + "    status.textContent='Sending...';\n"
            + "    fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorName:name,visitorHandle:handle,text:text,externalThreadId:'web:'+token+':'+(handle||name||'visitor')})})\n"
            + "      .then(function(r){ if(!r.ok){ throw new Error('Request failed'); } return r.json(); })\n"
            + "      .then(function(){ panel.querySelector('#focal_msg').value=''; status.textContent='Message sent. Our team will reply soon.'; })\n"
            + "      .catch(function(){ status.textContent='Could not send. Please try again.'; });\n"
            + "  }});\n"
            + "  root.appendChild(button); root.appendChild(panel); document.body.appendChild(root);\n"
            + "})();\n";
    }

    @Transactional
    public ChatConversationDto ingestWebsiteMessage(String widgetToken, ChatWidgetInboundRequestDto request) {
        if (isBlank(widgetToken)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Widget token is required");
        }

        ChatWidgetConfig config = widgetConfigRepository.findByWidgetToken(widgetToken)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Widget not found"));

        if (!Boolean.TRUE.equals(config.getEnabled())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Widget disabled");
        }

        if (request == null || isBlank(request.text())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "text is required");
        }

        String name = isBlank(request.visitorName()) ? "Website Visitor" : request.visitorName().trim();
        String handle = isBlank(request.visitorHandle())
            ? ("visitor-" + UUID.randomUUID().toString().substring(0, 8))
            : request.visitorHandle().trim();
        String externalThreadId = isBlank(request.externalThreadId())
            ? "webchat:" + widgetToken + ":" + handle.toLowerCase(Locale.ROOT)
            : request.externalThreadId().trim();

        return ingestInboundMessage(new ChatInboundMessageRequestDto(
            "webchat",
            externalThreadId,
            name,
            handle,
            request.text().trim()
        ));
    }

    @Transactional(readOnly = true)
    public String verifyMetaWebhook(String mode, String verifyToken, String challenge) {
        if (!"subscribe".equals(mode)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid mode");
        }
        if (isBlank(metaVerifyToken) || !metaVerifyToken.equals(verifyToken)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid verify token");
        }
        if (isBlank(challenge)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing challenge");
        }
        return challenge;
    }

    @Transactional
    public int ingestMetaWebhook(Map<String, Object> payload) {
        if (payload == null) {
            return 0;
        }

        int created = 0;

        String flatChannel = asString(payload.get("channel"));
        String flatText = asString(payload.get("text"));
        String flatHandle = asString(payload.get("customerHandle"));
        if (!isBlank(flatChannel) && !isBlank(flatText) && !isBlank(flatHandle)) {
            ingestInboundMessage(new ChatInboundMessageRequestDto(
                flatChannel,
                asString(payload.get("externalThreadId")),
                asString(payload.get("customerName")),
                flatHandle,
                flatText
            ));
            created++;
        }

        for (Object entryObj : asList(payload.get("entry"))) {
            Map<String, Object> entry = asMap(entryObj);
            for (Object changeObj : asList(entry.get("changes"))) {
                Map<String, Object> change = asMap(changeObj);
                Map<String, Object> value = asMap(change.get("value"));
                if (value.isEmpty()) {
                    continue;
                }

                List<Object> waMessages = asList(value.get("messages"));
                if (!waMessages.isEmpty()) {
                    String customerName = "Customer";
                    List<Object> contacts = asList(value.get("contacts"));
                    if (!contacts.isEmpty()) {
                        Map<String, Object> firstContact = asMap(contacts.get(0));
                        Map<String, Object> profile = asMap(firstContact.get("profile"));
                        String name = asString(profile.get("name"));
                        if (!isBlank(name)) {
                            customerName = name;
                        }
                    }
                    Map<String, Object> metadata = asMap(value.get("metadata"));
                    String phoneNumberId = asString(metadata.get("phone_number_id"));
                    for (Object msgObj : waMessages) {
                        Map<String, Object> msg = asMap(msgObj);
                        String from = asString(msg.get("from"));
                        String messageId = asString(msg.get("id"));
                        Map<String, Object> text = asMap(msg.get("text"));
                        String body = asString(text.get("body"));
                        if (isBlank(from) || isBlank(body)) {
                            continue;
                        }
                        String externalThreadId = "wa:" + (isBlank(phoneNumberId) ? "line" : phoneNumberId) + ":" + (isBlank(messageId) ? from : messageId);
                        ingestInboundMessage(new ChatInboundMessageRequestDto(
                            "whatsapp",
                            externalThreadId,
                            customerName,
                            from,
                            body
                        ));
                        created++;
                    }
                }

                List<Object> igMessaging = asList(value.get("messaging"));
                for (Object eventObj : igMessaging) {
                    Map<String, Object> event = asMap(eventObj);
                    Map<String, Object> sender = asMap(event.get("sender"));
                    Map<String, Object> message = asMap(event.get("message"));
                    String senderId = asString(sender.get("id"));
                    String text = asString(message.get("text"));
                    if (isBlank(senderId) || isBlank(text)) {
                        continue;
                    }
                    String mid = asString(message.get("mid"));
                    String externalThreadId = "ig:" + (isBlank(mid) ? senderId : mid);
                    ingestInboundMessage(new ChatInboundMessageRequestDto(
                        "instagram",
                        externalThreadId,
                        "Instagram User",
                        senderId,
                        text
                    ));
                    created++;
                }
            }
        }

        return created;
    }

    private ChatMessage saveMessage(ChatConversation conversation, String senderType, String senderName, String text) {
        ChatConversation persistedConversation = conversationRepository.save(conversation);
        ChatMessage message = new ChatMessage();
        message.setConversation(persistedConversation);
        message.setSenderType(senderType);
        message.setSenderName(senderName);
        message.setMessageBody(text);
        return messageRepository.save(message);
    }

    private User pickFairOnlineAgent() {
        List<User> onlineAgents = userRepository.findOnlineAgents();
        if (onlineAgents.isEmpty()) {
            return null;
        }

        User selected = null;
        long minLoad = Long.MAX_VALUE;

        for (User agent : onlineAgents) {
            long load = conversationRepository.countActiveAssigned(agent.getId());
            if (selected == null || load < minLoad || (load == minLoad && agent.getId() < selected.getId())) {
                selected = agent;
                minLoad = load;
            }
        }

        return selected;
    }

    private void ensureDefaultChannels(User user) {
        List<String> required = List.of("instagram", "whatsapp");
        for (String channelType : required) {
            channelRepository.findByUserIdAndChannelType(user.getId(), channelType)
                .orElseGet(() -> {
                    ChatChannelLink channel = new ChatChannelLink();
                    channel.setUser(user);
                    channel.setChannelType(channelType);
                    channel.setHandle(defaultHandle(channelType));
                    channel.setConnected(false);
                    return channelRepository.save(channel);
                });
        }
    }

    private ChatWidgetConfig ensureWidgetConfig(User user) {
        return widgetConfigRepository.findByUserId(user.getId())
            .orElseGet(() -> {
                ChatWidgetConfig created = new ChatWidgetConfig();
                created.setUser(user);
                created.setWebsiteName("My Website");
                created.setEnabled(false);
                created.setWidgetToken("wgt_" + UUID.randomUUID().toString().replace("-", ""));
                return widgetConfigRepository.save(created);
            });
    }

    private void ensureAccess(User requester, ChatConversation conversation) {
        String role = normalizeRole(requester.getRole());
        if ("AGENT".equals(role)) {
            if (conversation.getAssignedUser() == null || !conversation.getAssignedUser().getId().equals(requester.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
            }
        }
    }

    private User ensureUser(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private ChatChannelDto toChannelDto(ChatChannelLink channel) {
        ChatChannelDto dto = new ChatChannelDto();
        dto.setType(channel.getChannelType());
        dto.setLabel("whatsapp".equals(channel.getChannelType())
            ? "WhatsApp Business"
            : "Instagram Messenger");
        dto.setHandle(channel.getHandle());
        dto.setConnected(Boolean.TRUE.equals(channel.getConnected()));
        dto.setLastSyncAt(channel.getLastSyncAt() != null ? channel.getLastSyncAt().format(DATE_TIME_FORMATTER) : null);
        return dto;
    }

    private ChatConversationDto toConversationDto(ChatConversation conversation) {
        ChatConversationDto dto = new ChatConversationDto();
        dto.setId(conversation.getId());
        dto.setChannel(conversation.getChannelType());
        dto.setCustomerName(conversation.getCustomerName());
        dto.setCustomerHandle(conversation.getCustomerHandle());
        dto.setStatus(conversation.getStatus());
        dto.setUnread(conversation.getUnreadCount() == null ? 0 : conversation.getUnreadCount());
        dto.setLastMessageAt(conversation.getLastMessageAt() != null ? conversation.getLastMessageAt().format(DATE_TIME_FORMATTER) : null);
        dto.setAssignedUserId(conversation.getAssignedUser() != null ? conversation.getAssignedUser().getId() : null);
        dto.setAssignedTo(conversation.getAssignedUser() != null ? buildUserName(conversation.getAssignedUser()) : "Unassigned");
        return dto;
    }

    private ChatMessageDto toMessageDto(ChatMessage message) {
        ChatMessageDto dto = new ChatMessageDto();
        dto.setId(message.getId());
        dto.setSender(message.getSenderType());
        dto.setSenderName(message.getSenderName());
        dto.setText(message.getMessageBody());
        dto.setAt(message.getSentAt() != null ? message.getSentAt().format(DATE_TIME_FORMATTER) : null);
        return dto;
    }

    private ChatWidgetConfigDto toWidgetDto(ChatWidgetConfig config) {
        ChatWidgetConfigDto dto = new ChatWidgetConfigDto();
        dto.setWebsiteName(config.getWebsiteName());
        dto.setEnabled(Boolean.TRUE.equals(config.getEnabled()));
        dto.setWidgetToken(config.getWidgetToken());
        dto.setInboundUrl(buildPublicUrl("/api/crm/chats/widget/" + config.getWidgetToken() + "/inbound"));
        dto.setScriptSnippet("<script src=\""
            + buildPublicUrl("/api/crm/chats/widget/" + config.getWidgetToken() + "/loader.js")
            + "\"></script>");
        return dto;
    }

    private String buildPublicUrl(String path) {
        String base = isBlank(publicBaseUrl) ? "http://localhost:8080" : publicBaseUrl.trim();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        if (!path.startsWith("/")) {
            return base + "/" + path;
        }
        return base + path;
    }

    private String normalizeRole(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            return "";
        }
        String role = rawRole.trim().toUpperCase(Locale.ROOT);
        if (role.startsWith("ROLE_")) {
            role = role.substring("ROLE_".length());
        }
        if ("2".equals(role)) return "AGENT";
        if ("1".equals(role)) return "ADMIN";
        return role;
    }

    private String normalizeSocialChannel(String value) {
        String normalized = normalizeChannel(value);
        if (!"whatsapp".equals(normalized) && !"instagram".equals(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OAuth is only supported for WhatsApp/Instagram");
        }
        return normalized;
    }

    private String normalizeChannel(String value) {
        if (isBlank(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "channel is required");
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (!"whatsapp".equals(normalized) && !"instagram".equals(normalized) && !"webchat".equals(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported channel: " + value);
        }
        return normalized;
    }

    private String defaultHandle(String channelType) {
        return "whatsapp".equals(channelType)
            ? "+212 600 000 000"
            : "@focal_support";
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String buildUserName(User user) {
        if (user == null) return "Unassigned";
        String first = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String last = user.getLastName() == null ? "" : user.getLastName().trim();
        String full = (first + " " + last).trim();
        return full.isBlank() ? (user.getEmail() == null ? "User" : user.getEmail()) : full;
    }

    private void cleanupOauthStates() {
        LocalDateTime now = LocalDateTime.now();
        oauthStates.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String safeJsString(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("'", "\\'").replace("\r", " ").replace("\n", " ");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Object> asList(Object value) {
        if (value instanceof List<?> list) {
            return (List<Object>) list;
        }
        return List.of();
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private record OAuthState(Long userId, String channelType, LocalDateTime expiresAt) {}
}
