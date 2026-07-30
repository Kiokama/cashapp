package com.cashapp.repository;

import com.cashapp.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, String> {
    @Query("SELECT al FROM AuditLog al JOIN Transaction t ON al.transactionId = t.id WHERE t.spaceId = :spaceId ORDER BY al.createdAt DESC")
    List<AuditLog> findBySpaceId(@Param("spaceId") String spaceId);
}
