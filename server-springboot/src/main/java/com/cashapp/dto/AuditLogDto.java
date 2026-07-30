package com.cashapp.dto;

import lombok.*;

public class AuditLogDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AuditLogResponse {
        private String id;
        private String transactionId;
        private String userId;
        private String userName;
        private String actionType;
        private String description;
        private String createdAt;
    }
}
