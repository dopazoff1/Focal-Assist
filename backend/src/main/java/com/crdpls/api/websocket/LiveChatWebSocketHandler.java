package com.crdpls.api.websocket;

import com.crdpls.api.service.LiveChatBroadcaster;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;

@Component
public class LiveChatWebSocketHandler extends TextWebSocketHandler {
    private final LiveChatBroadcaster broadcaster;

    public LiveChatWebSocketHandler(LiveChatBroadcaster broadcaster) {
        this.broadcaster = broadcaster;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        broadcaster.register(session, parseSessionId(session));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // Messages are persisted through REST endpoints. WebSocket is used for realtime delivery.
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        broadcaster.unregister(session);
    }

    private Long parseSessionId(WebSocketSession session) {
        Map<String, Object> attrs = session.getAttributes();
        Object fromAttrs = attrs.get("sessionId");
        if (fromAttrs != null) {
            try { return Long.parseLong(String.valueOf(fromAttrs)); } catch (Exception ignored) {}
        }
        String query = session.getUri() == null ? "" : session.getUri().getQuery();
        if (query == null || query.isBlank()) return null;
        for (String part : query.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2 && "sessionId".equals(kv[0])) {
                try { return Long.parseLong(kv[1]); } catch (Exception ignored) {}
            }
        }
        return null;
    }
}
