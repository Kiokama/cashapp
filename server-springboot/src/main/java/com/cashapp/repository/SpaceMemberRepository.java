package com.cashapp.repository;

import com.cashapp.model.SpaceMember;
import com.cashapp.model.SpaceMemberId;
import com.cashapp.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface SpaceMemberRepository extends JpaRepository<SpaceMember, SpaceMemberId> {
    List<SpaceMember> findByIdSpaceId(String spaceId);

    @Query("SELECT u FROM User u JOIN SpaceMember sm ON u.id = sm.id.userId WHERE sm.id.spaceId = :spaceId")
    List<User> findUsersBySpaceId(@Param("spaceId") String spaceId);
}
