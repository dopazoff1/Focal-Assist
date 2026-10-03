package com.focal.api.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class LiveChatWebSocketConfig implements WebSocketConfigurer {
    private final LiveChatWebSocketHandler handler;

    public LiveChatWebSocketConfig(LiveChatWebSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/live-chat").setAllowedOriginPatterns("*");
    }
}
