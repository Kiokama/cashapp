package com.cashapp.service;

import com.cashapp.dto.AnalyticsDto;
import com.cashapp.dto.TransactionDto;
import com.cashapp.model.SplitDetail;
import com.cashapp.model.Transaction;
import com.cashapp.model.User;
import com.cashapp.repository.SpaceMemberRepository;
import com.cashapp.repository.SplitDetailRepository;
import com.cashapp.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BalanceService {

    private final TransactionRepository transactionRepository;
    private final SplitDetailRepository splitDetailRepository;
    private final SpaceMemberRepository spaceMemberRepository;
    private final TransactionService transactionService;

    public Map<String, Object> calculateBalances(String spaceId) {
        List<User> members = spaceMemberRepository.findUsersBySpaceId(spaceId);
        List<Transaction> transactions = transactionRepository.findBySpaceIdAndIsDeletedFalseOrderByTransactionDateDesc(spaceId);

        List<String> txIds = transactions.stream().map(Transaction::getId).collect(Collectors.toList());
        List<SplitDetail> splits = txIds.isEmpty() ? Collections.emptyList() : splitDetailRepository.findByTransactionIdIn(txIds);
        Map<String, List<SplitDetail>> splitMap = splits.stream().collect(Collectors.groupingBy(SplitDetail::getTransactionId));

        Map<String, BigDecimal> netBalances = new HashMap<>();
        for (User u : members) {
            netBalances.put(u.getId(), BigDecimal.ZERO);
        }

        for (Transaction tx : transactions) {
            String payer = tx.getPaidBy();
            BigDecimal amount = tx.getAmount();

            netBalances.put(payer, netBalances.getOrDefault(payer, BigDecimal.ZERO).add(amount));

            List<SplitDetail> txSplits = splitMap.getOrDefault(tx.getId(), Collections.emptyList());
            for (SplitDetail s : txSplits) {
                String debtor = s.getUserId();
                BigDecimal owed = s.getOwedAmount();
                netBalances.put(debtor, netBalances.getOrDefault(debtor, BigDecimal.ZERO).subtract(owed));
            }
        }

        return Map.of(
            "spaceId", spaceId,
            "netBalances", netBalances,
            "currency", "VND"
        );
    }

    @Transactional
    public TransactionDto.TransactionResponse createSettlement(String userId, String spaceId, AnalyticsDto.SettlementRequest req) {
        TransactionDto.TransactionRequest txReq = new TransactionDto.TransactionRequest();
        txReq.setSpaceId(spaceId);
        txReq.setAmount(req.getAmount());
        txReq.setDescription(req.getNote() != null ? req.getNote() : "Thanh toán cấn trừ nợ");
        txReq.setCategory("settlement");
        txReq.setPaidBy(req.getPaidBy() != null ? req.getPaidBy() : userId);
        txReq.setIsSettlement(true);
        txReq.setSplitType("SPLIT_EXACT");

        TransactionDto.SplitDetailDto split = new TransactionDto.SplitDetailDto();
        split.setUserId(req.getReceivedBy());
        split.setOwedAmount(req.getAmount());
        split.setPercentage(new BigDecimal(100));

        txReq.setSplits(List.of(split));

        return transactionService.createTransaction(userId, spaceId, txReq);
    }
}
