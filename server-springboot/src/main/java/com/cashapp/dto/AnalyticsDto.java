package com.cashapp.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

public class AnalyticsDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CategorySummaryItem {
        private String categoryId;
        private BigDecimal totalAmount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TrendItem {
        private String month;
        private BigDecimal total;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SettlementRequest {
        private String spaceId;
        private BigDecimal amount;
        private String paidBy;
        private String receivedBy;
        private String note;
    }
}
