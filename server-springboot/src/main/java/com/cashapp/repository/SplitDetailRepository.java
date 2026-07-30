package com.cashapp.repository;

import com.cashapp.model.SplitDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SplitDetailRepository extends JpaRepository<SplitDetail, String> {
    List<SplitDetail> findByTransactionId(String transactionId);
    List<SplitDetail> findByTransactionIdIn(List<String> transactionIds);
    void deleteByTransactionId(String transactionId);
}
