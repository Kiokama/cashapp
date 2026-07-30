package com.cashapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class WebSocketRoomHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();
    // spaceId -> Set of WebSocketSession
    private final Map<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();
    // sessionId -> spaceId
    private final Map<String, String> sessionRooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        System.out.println("⚡ [WebSocket SpringBoot] Client connected: " + session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            Map<String, Object> payload = objectMapper.readValue(message.getPayload(), Map.class);
            String type = (String) payload.get("type");

            if ("SUBSCRIBE_SPACE".equals(type)) {
                String spaceId = (String) payload.get("spaceId");
                if (spaceId != null) {
                    // Remove from previous room
                    String prevRoom = sessionRooms.get(session.getId());
                    if (prevRoom != null && roomSessions.containsKey(prevRoom)) {
                        roomSessions.get(prevRoom).remove(session);
                    }

                    // Add to new room
                    roomSessions.computeIfAbsent(spaceId, k -> new CopyOnWriteArraySet<>()).add(session);
                    sessionRooms.put(session.getId(), spaceId);
                    System.out.println("⚡ [WebSocket SpringBoot] Session " + session.getId() + " subscribed to space: " + spaceId);
                }
            }
        } catch (Exception e) {
            System.err.println("WebSocket message handle error: " + e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String spaceId = sessionRooms.remove(session.getId());
        if (spaceId != null && roomSessions.containsKey(spaceId)) {
            roomSessions.get(spaceId).remove(session);
        }
        System.out.println("⚡ [WebSocket SpringBoot] Client disconnected: " + session.getId());
    }

    public void broadcastToSpace(String spaceId, Map<String, Object> messageMap) {
        Set<WebSocketSession> sessions = roomSessions.get(spaceId);
        if (sessions == null || sessions.isEmpty()) return;

        try {
            String jsonMessage = objectMapper.writeValueAsString(messageMap);
            TextMessage textMessage = new TextMessage(jsonMessage);
            for (WebSocketSession session : sessions) {
                if (session.isOpen()) {
                    session.sendMessage(textMessage);
                }
            }
        } catch (IOException e) {
            System.err.println("Broadcast error: " + e.getMessage());
        }
    }
}
