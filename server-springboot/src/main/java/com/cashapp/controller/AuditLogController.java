package com.cashapp.controller;

import com.cashapp.dto.AuditLogDto;
import com.cashapp.model.AuditLog;
import com.cashapp.model.User;
import com.cashapp.repository.AuditLogRepository;
import com.cashapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @GetMapping("/spaces/{spaceId}/audit-logs")
    public ResponseEntity<List<AuditLogDto.AuditLogResponse>> getAuditLogs(@PathVariable String spaceId) {
        List<AuditLog> logs = auditLogRepository.findBySpaceId(spaceId);
        List<String> userIds = logs.stream().map(AuditLog::getUserId).collect(Collectors.toList());
        Map<String, String> userNames = userIds.isEmpty() ? Collections.emptyMap() :
                userRepository.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, User::getFullName));

        List<AuditLogDto.AuditLogResponse> dtos = logs.stream().map(log -> AuditLogDto.AuditLogResponse.builder()
                .id(log.getId())
                .transactionId(log.getTransactionId())
                .userId(log.getUserId())
                .userName(userNames.getOrDefault(log.getUserId(), "Thành viên"))
                .actionType(log.getActionType())
                .description(log.getDescription())
                .createdAt(log.getCreatedAt() != null ? log.getCreatedAt().toString() : null)
                .build()
        ).collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/notifications")
    public ResponseEntity<List<Object>> getNotifications() {
        return ResponseEntity.ok(Collections.emptyList());
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "Spring Boot Backend"));
    }
}
