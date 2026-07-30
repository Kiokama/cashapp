package com.cashapp.repository;

import com.cashapp.model.Space;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface SpaceRepository extends JpaRepository<Space, String> {
    Optional<Space> findByInviteCodeIgnoreCase(String inviteCode);

    @Query("SELECT s FROM Space s JOIN SpaceMember sm ON s.id = sm.id.spaceId WHERE sm.id.userId = :userId")
    List<Space> findByUserId(@Param("userId") String userId);
}
