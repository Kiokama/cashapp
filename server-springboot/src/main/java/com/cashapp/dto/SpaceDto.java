package com.cashapp.dto;

import lombok.*;
import java.util.List;
import java.util.Map;

public class SpaceDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateSpaceRequest {
        private String name;
        private String emoji;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class JoinSpaceRequest {
        private String inviteCode;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SpaceResponse {
        private String id;
        private String name;
        private String emoji;
        private String inviteCode;
        private String createdBy;
        private List<String> members;
        private List<AuthDto.UserDto> memberDetails;
        private Map<String, Object> budgets;
        private String createdAt;
    }
}
