package com.cashapp.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "split_details")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SplitDetail {
    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "transaction_id", nullable = false, length = 64)
    private String transactionId;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(name = "owed_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal owedAmount;

    @Column(precision = 5, scale = 2)
    private BigDecimal percentage;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
