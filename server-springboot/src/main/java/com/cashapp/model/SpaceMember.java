package com.cashapp.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "space_members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpaceMember {
    @EmbeddedId
    private SpaceMemberId id;

    @Column(length = 20)
    private String role; // 'MEMBER' or 'ADMIN'

    @Column(name = "joined_at")
    private OffsetDateTime joinedAt;

    @PrePersist
    protected void onCreate() {
        if (joinedAt == null) joinedAt = OffsetDateTime.now();
        if (role == null) role = "MEMBER";
    }
}
