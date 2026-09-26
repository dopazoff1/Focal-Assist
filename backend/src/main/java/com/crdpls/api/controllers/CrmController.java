package com.crdpls.api.controllers;

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
import com.crdpls.api.dto.CrmCaseDto;
import com.crdpls.api.dto.CrmQueueGroupDto;
import com.crdpls.api.dto.CrmTicketUpdateRequestDto;
import com.crdpls.api.dto.MyPlaylistResponseDto;
import com.crdpls.api.dto.QaEvaluationCreateRequestDto;
import com.crdpls.api.dto.QaEvaluationDto;
import com.crdpls.api.service.ChatService;
import com.crdpls.api.service.CrmService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/crm")
@CrossOrigin("*")
public class CrmController {

    private final CrmService crmService;
    private final ChatService chatService;

    public CrmController(CrmService crmService, ChatService chatService) {
        this.crmService = crmService;
        this.chatService = chatService;
    }

    @GetMapping("/my-playlist/{userId}")
    public MyPlaylistResponseDto getMyPlaylist(@PathVariable Long userId) {
        return crmService.getMyPlaylist(userId);
    }

    @GetMapping("/open-cases/{userId}")
    public List<CrmQueueGroupDto> getOpenCases(@PathVariable Long userId) {
        return crmService.getOpenCases(userId);
    }

    @GetMapping("/all-cases")
    public List<CrmCaseDto> getAllCases() {
        return crmService.getAllCases();
    }

    @PostMapping("/my-playlist/{userId}/submit-next/{conversationId}")
    public MyPlaylistResponseDto submitAndAssignNext(
        @PathVariable Long userId,
        @PathVariable Long conversationId,
        @RequestBody CrmTicketUpdateRequestDto request
    ) {
        return crmService.submitAndAssignNext(userId, conversationId, request);
    }

    @PutMapping("/cases/{userId}/{conversationId}")
    public CrmCaseDto updateAssignedCase(
        @PathVariable Long userId,
        @PathVariable Long conversationId,
        @RequestBody CrmTicketUpdateRequestDto request
    ) {
        return crmService.updateAssignedCase(userId, conversationId, request);
    }

    @PostMapping("/cases/{userId}/{conversationId}/internal-note")
    public Map<String, Object> addInternalNote(
        @PathVariable Long userId,
        @PathVariable Long conversationId,
        @RequestBody Map<String, String> payload
    ) {
        return crmService.addInternalNote(userId, conversationId, payload == null ? "" : payload.getOrDefault("note", ""));
    }

    @GetMapping("/evaluations")
    public List<QaEvaluationDto> getEvaluations() {
        return crmService.getVisibleEvaluations();
    }

    @GetMapping("/evaluations/case/{conversationId}")
    public List<QaEvaluationDto> getEvaluationsByCase(@PathVariable Long conversationId) {
        return crmService.getVisibleEvaluationsForConversation(conversationId);
    }

    @PostMapping("/evaluations")
    public QaEvaluationDto createEvaluation(@RequestBody QaEvaluationCreateRequestDto request) {
        return crmService.createEvaluation(request);
    }

    @GetMapping("/chats/channels/{userId}")
    public List<ChatChannelDto> getChatChannels(@PathVariable Long userId) {
        return chatService.listChannels(userId);
    }

    @GetMapping("/chats/oauth/{userId}/{channelType}/start")
    public ChatOauthStartDto startChatOauth(@PathVariable Long userId, @PathVariable String channelType) {
        return chatService.startOAuth(userId, channelType);
    }

    @GetMapping("/chats/oauth/callback")
    public ResponseEntity<String> finishChatOauth(
        @RequestParam(required = false) String state,
        @RequestParam(required = false) String code,
        @RequestParam(required = false) String error,
        @RequestParam(name = "error_description", required = false) String errorDescription
    ) {
        String finalError = (errorDescription != null && !errorDescription.isBlank()) ? errorDescription : error;
        ChatChannelDto linked = chatService.completeOAuth(state, code, finalError);
        String html = "<html><body style=\"font-family:Arial,sans-serif;padding:24px;color:#0f172a\">"
            + "<h2 style=\"margin:0 0 8px\">Channel linked successfully</h2>"
            + "<p style=\"margin:0 0 16px;color:#475569\">"
            + linked.getLabel() + " is now connected in Focal.</p>"
            + "<button onclick=\"window.close()\" style=\"background:#0f62fe;color:#fff;border:0;padding:10px 14px;border-radius:8px;cursor:pointer\">Close window</button>"
            + "</body></html>";
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    @GetMapping("/chats/meta/webhook")
    public ResponseEntity<String> verifyMetaWebhook(
        @RequestParam(name = "hub.mode", required = false) String mode,
        @RequestParam(name = "hub.verify_token", required = false) String verifyToken,
        @RequestParam(name = "hub.challenge", required = false) String challenge
    ) {
        return ResponseEntity.ok(chatService.verifyMetaWebhook(mode, verifyToken, challenge));
    }

    @PostMapping("/chats/meta/webhook")
    public Map<String, Object> receiveMetaWebhook(@RequestBody(required = false) Map<String, Object> payload) {
        int created = chatService.ingestMetaWebhook(payload);
        return Map.of("received", true, "created", created);
    }

    @PutMapping("/chats/channels/{userId}/{channelType}/link")
    public ChatChannelDto linkChatChannel(
        @PathVariable Long userId,
        @PathVariable String channelType,
        @RequestBody(required = false) ChatLinkRequestDto request
    ) {
        return chatService.linkChannel(userId, channelType, request);
    }

    @DeleteMapping("/chats/channels/{userId}/{channelType}/link")
    public ChatChannelDto unlinkChatChannel(@PathVariable Long userId, @PathVariable String channelType) {
        return chatService.unlinkChannel(userId, channelType);
    }

    @GetMapping("/chats/widget/{userId}")
    public ChatWidgetConfigDto getWidgetConfig(@PathVariable Long userId) {
        return chatService.getWidgetConfig(userId);
    }

    @PutMapping("/chats/widget/{userId}")
    public ChatWidgetConfigDto updateWidgetConfig(@PathVariable Long userId, @RequestBody ChatWidgetConfigRequestDto request) {
        return chatService.updateWidgetConfig(userId, request);
    }

    @GetMapping(value = "/chats/widget/{widgetToken}/loader.js", produces = "application/javascript")
    public ResponseEntity<String> widgetLoaderScript(@PathVariable String widgetToken) {
        return ResponseEntity.ok()
            .contentType(MediaType.valueOf("application/javascript"))
            .body(chatService.buildWidgetLoaderScript(widgetToken));
    }

    @PostMapping("/chats/widget/{widgetToken}/inbound")
    public ChatConversationDto ingestWidgetInbound(
        @PathVariable String widgetToken,
        @RequestBody ChatWidgetInboundRequestDto request
    ) {
        return chatService.ingestWebsiteMessage(widgetToken, request);
    }

    @GetMapping("/chats/{userId}")
    public List<ChatConversationDto> getMyChats(@PathVariable Long userId) {
        return chatService.listConversations(userId);
    }

    @GetMapping("/chats/{userId}/{conversationId}/messages")
    public List<ChatMessageDto> getChatMessages(@PathVariable Long userId, @PathVariable Long conversationId) {
        return chatService.getMessages(userId, conversationId);
    }

    @PostMapping("/chats/{userId}/{conversationId}/reply")
    public ChatMessageDto replyChat(
        @PathVariable Long userId,
        @PathVariable Long conversationId,
        @RequestBody ChatReplyRequestDto request
    ) {
        return chatService.sendReply(userId, conversationId, request);
    }

    @PostMapping("/chats/inbound")
    public ChatConversationDto ingestInbound(@RequestBody ChatInboundMessageRequestDto request) {
        return chatService.ingestInboundMessage(request);
    }
}
