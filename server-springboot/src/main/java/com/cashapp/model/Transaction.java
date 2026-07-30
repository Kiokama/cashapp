package com.cashapp.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "transactions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaction {
    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "space_id", nullable = false, length = 64)
    private String spaceId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private String description;

    @Column(name = "category_id", nullable = false, length = 50)
    private String categoryId;

    @Column(name = "transaction_date", nullable = false)
    private OffsetDateTime transactionDate;

    @Column(name = "paid_by", nullable = false, length = 64)
    private String paidBy;

    @Column(name = "split_type", length = 30)
    private String splitType;

    @Column(name = "is_settlement")
    private Boolean isSettlement;

    @Column(name = "is_deleted")
    private Boolean isDeleted;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (updatedAt == null) updatedAt = OffsetDateTime.now();
        if (isSettlement == null) isSettlement = false;
        if (isDeleted == null) isDeleted = false;
        if (splitType == null) splitType = "SPLIT_EQUAL";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
