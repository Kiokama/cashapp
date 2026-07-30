package com.cashapp.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

public class TransactionDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SplitDetailDto {
        private String userId;
        private BigDecimal owedAmount;
        private BigDecimal percentage;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TransactionRequest {
        private String spaceId;
        private BigDecimal amount;
        private String description;
        private String category;
        private String date;
        private String paidBy;
        private String splitType;
        private Boolean isSettlement;
        private List<SplitDetailDto> splits;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TransactionResponse {
        private String id;
        private String spaceId;
        private BigDecimal amount;
        private String description;
        private String category;
        private String date;
        private String paidBy;
        private String splitType;
        private Boolean isSettlement;
        private List<SplitDetailDto> splitDetails;
        private List<SplitDetailDto> splits;
        private String createdAt;
        private String updatedAt;
    }
}
