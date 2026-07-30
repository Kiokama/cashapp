package com.cashapp.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;
import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class SpaceMemberId implements Serializable {
    @Column(name = "space_id", length = 64)
    private String spaceId;

    @Column(name = "user_id", length = 64)
    private String userId;
}
