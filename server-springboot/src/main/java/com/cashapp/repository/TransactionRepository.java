package com.cashapp.repository;

import com.cashapp.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, String> {
    List<Transaction> findBySpaceIdAndIsDeletedFalseOrderByTransactionDateDesc(String spaceId);

    @Query("SELECT t FROM Transaction t WHERE t.spaceId = :spaceId AND t.isDeleted = false " +
           "AND (:categoryId IS NULL OR :categoryId = 'all' OR t.categoryId = :categoryId) " +
           "ORDER BY t.transactionDate DESC")
    List<Transaction> filterTransactions(
        @Param("spaceId") String spaceId,
        @Param("categoryId") String categoryId
    );
}
