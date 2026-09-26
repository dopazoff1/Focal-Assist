package com.crdpls.api.service;

import com.crdpls.api.models.CemContact;
import com.crdpls.api.models.CemConversation;
import com.crdpls.api.models.CemInternalNote;
import com.crdpls.api.models.GmailAccount;
import com.crdpls.api.models.User;
import com.crdpls.api.repository.CemContactRepository;
import com.crdpls.api.repository.CemConversationRepository;
import com.crdpls.api.repository.CemInternalNoteRepository;
import com.crdpls.api.repository.GmailAccountRepository;
import com.crdpls.api.repository.UserRepository;
import com.crdpls.api.security.JwtService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class GmailService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^(.*?)(?:<([^>]+)>)?$");
    private static final DateTimeFormatter RFC_2822 = DateTimeFormatter.RFC_1123_DATE_TIME;
    private static final DateTimeFormatter PANEL_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final UserRepository userRepository;
    private final GmailAccountRepository gmailAccountRepository;
    private final CemConversationRepository conversationRepository;
    private final CemInternalNoteRepository internalNoteRepository;
    private final CemContactRepository contactRepository;
    private final JwtService jwtService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient;

    @Value("${gmail.client-id:}")
    private String clientId;

    @Value("${gmail.client-secret:}")
    private String clientSecret;

    @Value("${gmail.redirect-uri:http://localhost:8080/api/gmail/oauth/callback}")
    private String redirectUri;

    @Value("${gmail.scopes:https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send}")
    private String scopes;

    @Value("${app.public-base-url:http://localhost:8080}")
    private String publicBaseUrl;

    public GmailService(
        UserRepository userRepository,
        GmailAccountRepository gmailAccountRepository,
        CemConversationRepository conversationRepository,
        CemInternalNoteRepository internalNoteRepository,
        CemContactRepository contactRepository,
        JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.gmailAccountRepository = gmailAccountRepository;
        this.conversationRepository = conversationRepository;
        this.internalNoteRepository = internalNoteRepository;
        this.contactRepository = contactRepository;
        this.jwtService = jwtService;
        this.httpClient = HttpClient.newHttpClient();
    }

    public Map<String, String> getOAuthUrl(Long userId) {
        ensureConfig();
        ensureUser(userId);
        String state = String.valueOf(userId);
        String url = "https://accounts.google.com/o/oauth2/v2/auth"
            + "?client_id=" + enc(clientId)
            + "&redirect_uri=" + enc(redirectUri)
            + "&response_type=code"
            + "&access_type=offline"
            + "&prompt=consent"
            + "&scope=" + enc(scopes)
            + "&state=" + enc(state);

        Map<String, String> response = new HashMap<>();
        response.put("url", url);
        return response;
    }

    @Transactional
    public Map<String, Object> handleOAuthCallback(String code, String state, String error) {
        ensureConfig();
        if (error != null && !error.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OAuth error: " + error);
        }
        if (code == null || code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing authorization code");
        }
        if (state == null || state.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing state");
        }

        Long userId;
        try {
            userId = Long.parseLong(state.trim());
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid state");
        }

        User user = ensureUser(userId);
        JsonNode tokenJson = exchangeCodeForTokens(code);
        String accessToken = tokenJson.path("access_token").asText(null);
        if (accessToken == null || accessToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not obtain access token from Google");
        }

        String refreshToken = tokenJson.path("refresh_token").asText(null);
        long expiresIn = tokenJson.path("expires_in").asLong(3600);
        String gmailAddress = getGmailAddress(accessToken);

        GmailAccount account = gmailAccountRepository.findByUserId(userId).orElseGet(GmailAccount::new);
        account.setUser(user);
        account.setGmailAddress(gmailAddress);
        account.setAccessToken(accessToken);
        if (refreshToken != null && !refreshToken.isBlank()) {
            account.setRefreshToken(refreshToken);
        }
        account.setTokenExpiry(LocalDateTime.now().plusSeconds(expiresIn));
        gmailAccountRepository.save(account);

        Map<String, Object> response = new HashMap<>();
        response.put("connected", true);
        response.put("userId", userId);
        response.put("gmailAddress", gmailAddress);
        return response;
    }

    @Transactional
    public Map<String, Object> syncInbox(Long userId) {
        ensureConfig();
        ensureUser(userId);
        GmailAccount account = resolvePanelMailbox(userId);

        String accessToken;
        try {
            accessToken = ensureValidAccessToken(account);
        } catch (ResponseStatusException ex) {
            Map<String, Object> response = new HashMap<>();
            response.put("synced", false);
            response.put("created", 0);
            response.put("updated", 0);
            response.put("gmailAddress", account.getGmailAddress());
            response.put("error", ex.getReason() == null ? "Gmail sync failed" : ex.getReason());
            return response;
        }
        JsonNode threadsJson = getJson("https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=50", accessToken);
        JsonNode threads = threadsJson.path("threads");

        int created = 0;
        int updated = 0;
        if (threads.isArray()) {
            for (JsonNode t : threads) {
                String threadId = t.path("id").asText(null);
                if (threadId == null || threadId.isBlank()) {
                    continue;
                }
                JsonNode threadDetail = getJson(
                    "https://gmail.googleapis.com/gmail/v1/users/me/threads/" + enc(threadId)
                        + "?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date",
                    accessToken
                );

                UpsertResult result = upsertConversationFromThread(threadDetail, threadId, userId, account.getGmailAddress());
                if (result == UpsertResult.CREATED) {
                    created++;
                } else if (result == UpsertResult.UPDATED) {
                    updated++;
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("synced", true);
        response.put("created", created);
        response.put("updated", updated);
        response.put("gmailAddress", account.getGmailAddress());
        return response;
    }

    public Map<String, Object> getThread(Long userId, Long conversationId) {
        ensureConfig();
        ensureUser(userId);
        GmailAccount account = resolvePanelMailbox(userId);

        CemConversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        String accessToken = null;
        JsonNode thread = null;
        String gmailError = null;
        try {
            accessToken = ensureValidAccessToken(account);
            thread = getJson(
                "https://gmail.googleapis.com/gmail/v1/users/me/threads/" + enc(conversation.getGmailThreadId()) + "?format=full",
                accessToken
            );
        } catch (ResponseStatusException ex) {
            gmailError = ex.getReason() == null ? "Gmail unavailable" : ex.getReason();
        }

        record ThreadMessage(long sortAtEpochMillis, Map<String, Object> payload) {}

        List<ThreadMessage> items = new ArrayList<>();
        if (thread != null) {
            JsonNode rawMessages = thread.path("messages");
            if (rawMessages.isArray()) {
                for (JsonNode raw : rawMessages) {
                    String messageId = raw.path("id").asText("");
                    JsonNode headers = raw.path("payload").path("headers");
                    ParsedMessage parsed = parseMessagePayload(raw.path("payload"), userId, messageId);

                    String dateHeader = findHeader(headers, "Date", "");
                    long sortAt = parseEmailDateEpochMillis(dateHeader);

                    Map<String, Object> msg = new HashMap<>();
                    msg.put("id", messageId);
                    msg.put("from", findHeader(headers, "From", ""));
                    msg.put("to", findHeader(headers, "To", ""));
                    msg.put("subject", findHeader(headers, "Subject", ""));
                    msg.put("date", dateHeader);
                    msg.put("body", parsed.bodyHtml());
                    msg.put("attachments", parsed.attachments());
                    items.add(new ThreadMessage(sortAt, msg));
                }
            }
        }

        List<CemInternalNote> notes = internalNoteRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        for (CemInternalNote note : notes) {
            Map<String, Object> msg = new HashMap<>();
            msg.put("id", "note-" + note.getId());
            msg.put("from", note.getCreatedByUser() != null ? userDisplayName(note.getCreatedByUser()) : "Internal Note");
            msg.put("to", "Internal");
            msg.put("subject", "Internal Note");
            msg.put("date", note.getCreatedAt() != null ? note.getCreatedAt().format(PANEL_DATE) : "");
            msg.put("body", textToHtml(note.getNoteBody()));
            msg.put("internalNote", true);
            msg.put("attachments", List.of());
            long sortAt = note.getCreatedAt() != null
                ? note.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                : System.currentTimeMillis();
            items.add(new ThreadMessage(sortAt, msg));
        }

        items.sort((a, b) -> Long.compare(a.sortAtEpochMillis(), b.sortAtEpochMillis()));
        List<Map<String, Object>> messages = items.stream().map(ThreadMessage::payload).toList();

        Map<String, Object> response = new HashMap<>();
        response.put("conversationId", conversationId);
        response.put("threadId", conversation.getGmailThreadId());
        response.put("subject", conversation.getSubject());
        response.put("messages", messages);
        if (gmailError != null) {
            response.put("gmailAvailable", false);
            response.put("gmailError", gmailError);
        } else {
            response.put("gmailAvailable", true);
        }
        return response;
    }

    private long parseEmailDateEpochMillis(String value) {
        if (value == null || value.isBlank()) {
            return System.currentTimeMillis();
        }
        try {
            // Most Gmail headers are RFC 2822 with an explicit offset.
            return ZonedDateTime.parse(value, RFC_2822).toInstant().toEpochMilli();
        } catch (Exception ignored) {
        }
        try {
            return OffsetDateTime.parse(value).toInstant().toEpochMilli();
        } catch (Exception ignored) {
            return System.currentTimeMillis();
        }
    }

    public AttachmentPayload getAttachmentPayload(Long userId, String messageId, String attachmentId) {
        ensureConfig();
        ensureUser(userId);
        GmailAccount account = resolvePanelMailbox(userId);
        String accessToken = ensureValidAccessToken(account);
        JsonNode attachment = getJson(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/" + enc(messageId) + "/attachments/" + enc(attachmentId),
            accessToken
        );
        String encoded = attachment.path("data").asText("");
        byte[] data = decodeBodyBytes(encoded);
        return new AttachmentPayload(data);
    }

    public Map<String, Object> sendReply(Long userId, Long conversationId, String replyText) {
        ensureConfig();
        if (replyText == null || replyText.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reply cannot be empty");
        }

        ensureUser(userId);
        GmailAccount account = resolvePanelMailbox(userId);
        CemConversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        String accessToken = ensureValidAccessToken(account);
        JsonNode thread = getJson(
            "https://gmail.googleapis.com/gmail/v1/users/me/threads/" + enc(conversation.getGmailThreadId())
                + "?format=metadata&metadataHeaders=Message-ID&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=References",
            accessToken
        );

        JsonNode rawMessages = thread.path("messages");
        JsonNode last = rawMessages.isArray() && !rawMessages.isEmpty() ? rawMessages.get(rawMessages.size() - 1) : null;
        String messageIdHeader = last != null ? findHeader(last.path("payload").path("headers"), "Message-ID", "") : "";
        String referencesHeader = last != null ? findHeader(last.path("payload").path("headers"), "References", "") : "";
        String toEmail = Optional.ofNullable(conversation.getContact())
            .map(CemContact::getPrimaryEmail)
            .orElse("");
        if (toEmail == null || toEmail.isBlank()) {
            String from = last != null ? findHeader(last.path("payload").path("headers"), "From", "") : "";
            String replyTo = last != null ? findHeader(last.path("payload").path("headers"), "Reply-To", "") : "";
            toEmail = parseFromHeader(replyTo == null || replyTo.isBlank() ? from : replyTo).email();
        }
        if (toEmail == null || toEmail.isBlank() || "unknown@unknown.local".equalsIgnoreCase(toEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket owner email is missing on contact");
        }
        String subject = conversation.getSubject() == null ? "No subject" : conversation.getSubject();
        if (!subject.toLowerCase().startsWith("re:")) {
            subject = "Re: " + subject;
        }

        StringBuilder mimeBuilder = new StringBuilder();
        mimeBuilder
            .append("To: ").append(toEmail).append("\r\n")
            .append("Subject: ").append(subject).append("\r\n")
            .append("MIME-Version: 1.0\r\n");
        if (messageIdHeader != null && !messageIdHeader.isBlank()) {
            mimeBuilder.append("In-Reply-To: ").append(messageIdHeader).append("\r\n");
            String refs = (referencesHeader == null ? "" : referencesHeader.trim());
            if (!refs.isBlank()) {
                refs = refs + " " + messageIdHeader;
            } else {
                refs = messageIdHeader;
            }
            mimeBuilder.append("References: ").append(refs).append("\r\n");
        }
        String htmlBody = withVisibleThreadReference(replyText, conversationId);
        mimeBuilder
            .append("Content-Type: text/html; charset=\"UTF-8\"\r\n")
            .append("\r\n")
            .append(htmlBody);
        String mime = mimeBuilder.toString();
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(mime.getBytes(StandardCharsets.UTF_8));

        Map<String, Object> payload = new HashMap<>();
        payload.put("raw", raw);
        payload.put("threadId", conversation.getGmailThreadId());

        JsonNode sent = postJson("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", payload, accessToken);
        conversation.setLastMessageAt(LocalDateTime.now());
        conversationRepository.save(conversation);

        Map<String, Object> response = new HashMap<>();
        response.put("sent", true);
        response.put("gmailMessageId", sent.path("id").asText(""));
        response.put("threadId", sent.path("threadId").asText(conversation.getGmailThreadId()));
        return response;
    }

    private UpsertResult upsertConversationFromThread(JsonNode threadDetail, String threadId, Long userId, String connectedGmailAddress) {
        JsonNode messages = threadDetail.path("messages");
        if (!messages.isArray() || messages.isEmpty()) {
            return UpsertResult.SKIPPED;
        }

        JsonNode firstMessage = messages.get(0);
        JsonNode firstHeaders = firstMessage.path("payload").path("headers");
        JsonNode lastMessage = messages.get(messages.size() - 1);
        JsonNode lastHeaders = lastMessage.path("payload").path("headers");
        String subject = findHeader(firstHeaders, "Subject", "");
        if (subject == null || subject.isBlank()) {
            subject = findHeader(lastHeaders, "Subject", "(No subject)");
        }
        String dateRaw = findHeader(lastHeaders, "Date", "");
        boolean lastMessageFromCustomer = isExternalSender(lastHeaders, connectedGmailAddress);

        EmailIdentity identity = findExternalSender(messages, connectedGmailAddress);
        CemContact contact = findOrCreateContact(identity);
        LocalDateTime lastMessageAt = parseDate(dateRaw);

        Optional<CemConversation> existing = conversationRepository.findByGmailThreadId(threadId);
        if (existing.isPresent()) {
            CemConversation conversation = existing.get();
            LocalDateTime previousLastMessageAt = conversation.getLastMessageAt();
            boolean hasNewerMessage = previousLastMessageAt == null || (lastMessageAt != null && lastMessageAt.isAfter(previousLastMessageAt));
            conversation.setSubject(subject);
            conversation.setContact(contact);
            conversation.setLastMessageAt(lastMessageAt);
            if (conversation.getQueueName() == null || conversation.getQueueName().isBlank()) {
                conversation.setQueueName("Email Queue");
            }
            if (conversation.getStatus() == null || conversation.getStatus().isBlank()) {
                conversation.setStatus("open");
            }
            if (lastMessageFromCustomer && hasNewerMessage) {
                conversation.setStatus("open");
            }
            if (conversation.getPriority() == null || conversation.getPriority().isBlank()) {
                conversation.setPriority("normal");
            }
            conversationRepository.save(conversation);
            return UpsertResult.UPDATED;
        }

        User creator = ensureUser(userId);
        CemConversation conversation = new CemConversation();
        conversation.setGmailThreadId(threadId);
        conversation.setSubject(subject);
        conversation.setStatus("open");
        conversation.setPriority("normal");
        conversation.setQueueName("Email Queue");
        conversation.setCreatedByUser(creator);
        conversation.setContact(contact);
        conversation.setLastMessageAt(lastMessageAt);
        conversationRepository.save(conversation);
        return UpsertResult.CREATED;
    }

    private boolean isExternalSender(JsonNode headers, String connectedGmailAddress) {
        String from = findHeader(headers, "From", "");
        EmailIdentity identity = parseFromHeader(from);
        if (identity.email() == null || identity.email().isBlank()) {
            return false;
        }
        String sender = identity.email().trim().toLowerCase();
        String connected = connectedGmailAddress == null ? "" : connectedGmailAddress.trim().toLowerCase();
        return !sender.equals(connected) && !"unknown@unknown.local".equals(sender);
    }

    private EmailIdentity findExternalSender(JsonNode messages, String connectedGmailAddress) {
        String normalizedConnected = connectedGmailAddress == null ? "" : connectedGmailAddress.trim().toLowerCase();
        if (messages != null && messages.isArray()) {
            for (int i = messages.size() - 1; i >= 0; i--) {
                JsonNode message = messages.get(i);
                JsonNode headers = message.path("payload").path("headers");
                String from = findHeader(headers, "From", "");
                EmailIdentity candidate = parseFromHeader(from);
                if (candidate.email() == null || candidate.email().isBlank()) {
                    continue;
                }
                String candidateEmail = candidate.email().trim().toLowerCase();
                if (!candidateEmail.equals(normalizedConnected) && !"unknown@unknown.local".equals(candidateEmail)) {
                    return candidate;
                }
            }
        }
        if (messages != null && messages.isArray() && !messages.isEmpty()) {
            JsonNode headers = messages.get(messages.size() - 1).path("payload").path("headers");
            String from = findHeader(headers, "From", "");
            return parseFromHeader(from);
        }
        return new EmailIdentity("Unknown Sender", "unknown@unknown.local");
    }

    private CemContact findOrCreateContact(EmailIdentity identity) {
        CemContact contact = contactRepository.findByPrimaryEmailIgnoreCase(identity.email())
            .orElseGet(CemContact::new);
        contact.setPrimaryEmail(identity.email());
        if (identity.name() != null && !identity.name().isBlank()) {
            contact.setFullName(identity.name());
        }
        return contactRepository.save(contact);
    }

    private String ensureValidAccessToken(GmailAccount account) {
        if (account.getTokenExpiry() == null || account.getTokenExpiry().isAfter(LocalDateTime.now().plusMinutes(1))) {
            return account.getAccessToken();
        }
        if (account.getRefreshToken() == null || account.getRefreshToken().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Gmail token expired and no refresh token available");
        }

        try {
            String form = "client_id=" + enc(clientId)
                + "&client_secret=" + enc(clientSecret)
                + "&refresh_token=" + enc(account.getRefreshToken())
                + "&grant_type=refresh_token";

            HttpRequest request = HttpRequest.newBuilder(URI.create("https://oauth2.googleapis.com/token"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to refresh Gmail access token");
            }

            JsonNode tokenJson = objectMapper.readTree(response.body());
            String newAccessToken = tokenJson.path("access_token").asText(null);
            long expiresIn = tokenJson.path("expires_in").asLong(3600);
            if (newAccessToken == null || newAccessToken.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Invalid token refresh response");
            }

            account.setAccessToken(newAccessToken);
            account.setTokenExpiry(LocalDateTime.now().plusSeconds(expiresIn));
            gmailAccountRepository.save(account);
            return newAccessToken;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not refresh Gmail token", ex);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not refresh Gmail token", ex);
        }
    }

    private JsonNode exchangeCodeForTokens(String code) {
        try {
            String form = "code=" + enc(code)
                + "&client_id=" + enc(clientId)
                + "&client_secret=" + enc(clientSecret)
                + "&redirect_uri=" + enc(redirectUri)
                + "&grant_type=authorization_code";

            HttpRequest request = HttpRequest.newBuilder(URI.create("https://oauth2.googleapis.com/token"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google token exchange failed: " + response.body());
            }
            return objectMapper.readTree(response.body());
        } catch (IOException | InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not exchange code with Google", ex);
        }
    }

    private String getGmailAddress(String accessToken) {
        JsonNode profile = getJson("https://gmail.googleapis.com/gmail/v1/users/me/profile", accessToken);
        String email = profile.path("emailAddress").asText(null);
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not fetch Gmail address");
        }
        return email;
    }

    private JsonNode getJson(String url, String accessToken) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google API call failed: " + response.body());
            }
            return objectMapper.readTree(response.body());
        } catch (IOException | InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google API call failed", ex);
        }
    }

    private JsonNode postJson(String url, Map<String, Object> payload, String accessToken) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google API call failed: " + response.body());
            }
            return objectMapper.readTree(response.body());
        } catch (IOException | InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google API call failed", ex);
        }
    }

    private ParsedMessage parseMessagePayload(JsonNode payload, Long userId, String messageId) {
        if (payload == null || payload.isMissingNode()) {
            return new ParsedMessage("", List.of());
        }
        MessageAccumulator acc = new MessageAccumulator();
        collectPayload(payload, acc, userId, messageId);
        String html = !acc.htmlParts.isEmpty()
            ? String.join("<hr/>", acc.htmlParts)
            : textToHtml(String.join("\n\n", acc.textParts));
        html = replaceCidSources(html, acc.cidToUrl);
        html = stripLegacyMarkerText(html);
        return new ParsedMessage(html, acc.attachments);
    }

    private void collectPayload(JsonNode part, MessageAccumulator acc, Long userId, String messageId) {
        if (part == null || part.isMissingNode()) {
            return;
        }

        String mimeType = part.path("mimeType").asText("").toLowerCase();
        JsonNode parts = part.path("parts");
        if (mimeType.startsWith("multipart/") && parts.isArray()) {
            for (JsonNode nested : parts) {
                collectPayload(nested, acc, userId, messageId);
            }
            return;
        }

        String filename = part.path("filename").asText("");
        JsonNode body = part.path("body");
        String bodyData = body.path("data").asText("");
        String attachmentId = body.path("attachmentId").asText("");
        int size = body.path("size").asInt(0);
        JsonNode headers = part.path("headers");
        String contentDisposition = findHeader(headers, "Content-Disposition", "").toLowerCase();
        String contentId = normalizeContentId(findHeader(headers, "Content-ID", ""));

        if ("text/html".equals(mimeType)) {
            String html = decodeBody(bodyData);
            if (!html.isBlank()) {
                acc.htmlParts.add(html);
                return;
            }
        }
        if ("text/plain".equals(mimeType)) {
            String text = decodeBody(bodyData);
            if (!text.isBlank()) {
                acc.textParts.add(text);
                return;
            }
        }

        boolean hasAttachmentData = !attachmentId.isBlank() || !filename.isBlank() || (!bodyData.isBlank() && !mimeType.startsWith("text/"));
        if (!hasAttachmentData) {
            return;
        }

        boolean inline = contentDisposition.contains("inline") || !contentId.isBlank();
        String safeName = filename == null ? "" : filename;
        String downloadUrl = attachmentId.isBlank()
            ? toDataUrl(mimeType, decodeBodyBytes(bodyData))
            : buildAttachmentUrl(userId, messageId, attachmentId, mimeType, safeName);

        Map<String, Object> attachmentMeta = new HashMap<>();
        attachmentMeta.put("messageId", messageId);
        attachmentMeta.put("attachmentId", attachmentId);
        attachmentMeta.put("filename", safeName);
        attachmentMeta.put("mimeType", mimeType);
        attachmentMeta.put("size", size);
        attachmentMeta.put("inline", inline);
        attachmentMeta.put("contentId", contentId);
        attachmentMeta.put("downloadUrl", downloadUrl);
        acc.attachments.add(attachmentMeta);

        if (inline && !contentId.isBlank()) {
            acc.cidToUrl.put(contentId, downloadUrl);
        }
    }

    private String toDataUrl(String mimeType, byte[] data) {
        if (data == null || data.length == 0) {
            return "";
        }
        String safeMime = (mimeType == null || mimeType.isBlank()) ? "application/octet-stream" : mimeType;
        return "data:" + safeMime + ";base64," + Base64.getEncoder().encodeToString(data);
    }

    private String buildAttachmentUrl(Long userId, String messageId, String attachmentId, String mimeType, String filename) {
        String token = jwtService.generateAttachmentToken(userId, messageId, attachmentId);
        return publicBaseUrl + "/api/gmail/attachment/" + enc(String.valueOf(userId))
            + "/" + enc(messageId)
            + "/" + enc(attachmentId)
            + "?mimeType=" + enc(mimeType == null ? "application/octet-stream" : mimeType)
            + "&filename=" + enc(filename == null ? "" : filename)
            + "&token=" + enc(token);
    }

    private String replaceCidSources(String html, Map<String, String> cidToUrl) {
        if (html == null || html.isBlank() || cidToUrl.isEmpty()) {
            return html == null ? "" : html;
        }
        String updated = html;
        for (Map.Entry<String, String> entry : cidToUrl.entrySet()) {
            String cid = entry.getKey();
            String url = entry.getValue();
            updated = updated.replace("cid:" + cid, url);
            updated = updated.replace("cid:<" + cid + ">", url);
        }
        return updated;
    }

    private String stripLegacyMarkerText(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        String cleaned = html
            .replaceAll("(?is)<div[^>]*>\\s*Ref:\\s*CP-[^<]+</div>", "")
            .replaceAll("(?im)^\\s*Ref:\\s*CP-[^\\r\\n<]+\\s*$", "")
            .replaceAll("(?i)cp-\\d+-\\d+-[0-9a-f\\-]{20,}", "");
        return cleaned.trim();
    }

    private String normalizeContentId(String contentId) {
        if (contentId == null || contentId.isBlank()) {
            return "";
        }
        return contentId.replace("<", "").replace(">", "").trim();
    }

    private String textToHtml(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String escaped = text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;");
        return escaped.replace("\n", "<br/>");
    }

    private String decodeBody(String data) {
        if (data == null || data.isBlank()) {
            return "";
        }
        try {
            byte[] decoded = decodeBodyBytes(data);
            return new String(decoded, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            return "";
        }
    }

    private byte[] decodeBodyBytes(String data) {
        if (data == null || data.isBlank()) {
            return new byte[0];
        }
        return Base64.getUrlDecoder().decode(data);
    }

    private String findHeader(JsonNode headers, String name, String fallback) {
        if (headers != null && headers.isArray()) {
            for (JsonNode header : headers) {
                if (name.equalsIgnoreCase(header.path("name").asText())) {
                    String value = header.path("value").asText();
                    return value == null || value.isBlank() ? fallback : value;
                }
            }
        }
        return fallback;
    }

    private LocalDateTime parseDate(String value) {
        if (value == null || value.isBlank()) {
            return LocalDateTime.now();
        }
        try {
            return ZonedDateTime.parse(value, RFC_2822).toLocalDateTime();
        } catch (Exception ignored) {
        }
        try {
            return OffsetDateTime.parse(value).toLocalDateTime();
        } catch (Exception ignored) {
            return LocalDateTime.now();
        }
    }

    private EmailIdentity parseFromHeader(String fromHeader) {
        if (fromHeader == null || fromHeader.isBlank()) {
            return new EmailIdentity("Unknown Sender", "unknown@unknown.local");
        }
        Matcher matcher = EMAIL_PATTERN.matcher(fromHeader.trim());
        if (!matcher.matches()) {
            return new EmailIdentity(fromHeader.trim(), "unknown@unknown.local");
        }

        String rawName = matcher.group(1) == null ? "" : matcher.group(1).replace("\"", "").trim();
        String email = matcher.group(2) == null ? rawName : matcher.group(2).trim();
        if (!email.contains("@")) {
            email = "unknown@unknown.local";
        }
        String name = matcher.group(2) == null ? email : rawName;
        if (name == null || name.isBlank()) {
            name = email;
        }
        return new EmailIdentity(name, email.toLowerCase());
    }

    private String userDisplayName(User user) {
        if (user == null) {
            return "Internal Note";
        }
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        if (!fullName.isBlank()) {
            return fullName;
        }
        return user.getEmail() == null || user.getEmail().isBlank() ? "Internal Note" : user.getEmail().trim();
    }

    private User ensureUser(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private GmailAccount resolvePanelMailbox(Long userId) {
        return gmailAccountRepository.findByUserId(userId)
            .or(() -> gmailAccountRepository.findTopByOrderByIdAsc())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No Gmail mailbox connected in panel"));
    }

    private void ensureConfig() {
        if (isBlank(clientId) || isBlank(clientSecret) || isBlank(redirectUri)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Gmail OAuth properties are not configured");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String withVisibleThreadReference(String html, Long conversationId) {
        String safe = html == null ? "" : html;
        String shortRef = UUID.randomUUID().toString().substring(0, 8);
        String ts = String.valueOf(LocalDateTime.now().toEpochSecond(ZoneOffset.UTC));
        String ref = "CP-" + conversationId + "-" + shortRef + "-" + ts;
        return safe + "<div style=\"margin-top:10px;font-size:11px;color:#7a7a7a;\">Ref: " + ref + "</div>";
    }

    private enum UpsertResult {
        CREATED, UPDATED, SKIPPED
    }

    public record AttachmentPayload(byte[] data) { }

    private static final class MessageAccumulator {
        private final List<String> htmlParts = new ArrayList<>();
        private final List<String> textParts = new ArrayList<>();
        private final List<Map<String, Object>> attachments = new ArrayList<>();
        private final Map<String, String> cidToUrl = new HashMap<>();
    }

    private record ParsedMessage(String bodyHtml, List<Map<String, Object>> attachments) { }

    private record EmailIdentity(String name, String email) { }
}
