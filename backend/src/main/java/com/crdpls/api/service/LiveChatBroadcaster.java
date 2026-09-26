package com.crdpls.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LiveChatBroadcaster {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<Long, Set<WebSocketSession>> sessionsByChat = new ConcurrentHashMap<>();
    private final Set<WebSocketSession> globalSessions = ConcurrentHashMap.newKeySet();

    public void register(WebSocketSession session, Long chatSessionId) {
        globalSessions.add(session);
        if (chatSessionId != null) {
            sessionsByChat.computeIfAbsent(chatSessionId, key -> ConcurrentHashMap.newKeySet()).add(session);
        }
    }

    public void unregister(WebSocketSession session) {
        globalSessions.remove(session);
        for (Set<WebSocketSession> sessions : sessionsByChat.values()) {
            sessions.remove(session);
        }
    }

    public void broadcastSession(Long chatSessionId, String type, Map<String, Object> payload) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", type);
        event.put("sessionId", chatSessionId);
        event.put("payload", payload == null ? Map.of() : payload);
        Set<WebSocketSession> targets = ConcurrentHashMap.newKeySet();
        targets.addAll(globalSessions);
        Set<WebSocketSession> scoped = sessionsByChat.get(chatSessionId);
        if (scoped != null) {
            targets.addAll(scoped);
        }
        sendTo(targets, event);
    }

    private void sendTo(Collection<WebSocketSession> sessions, Map<String, Object> event) {
        String json;
        try {
            json = objectMapper.writeValueAsString(event);
        } catch (Exception ex) {
            return;
        }
        List<WebSocketSession> closed = new ArrayList<>();
        for (WebSocketSession session : sessions) {
            if (session == null || !session.isOpen()) {
                closed.add(session);
                continue;
            }
            try {
                session.sendMessage(new TextMessage(json));
            } catch (IOException ex) {
                closed.add(session);
            }
        }
        closed.forEach(this::unregister);
    }
}
