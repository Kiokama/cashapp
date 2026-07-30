package com.cashapp.service;

import com.cashapp.dto.TransactionDto;
import com.cashapp.model.AuditLog;
import com.cashapp.model.SplitDetail;
import com.cashapp.model.Transaction;
import com.cashapp.model.User;
import com.cashapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final SplitDetailRepository splitDetailRepository;
    private final SpaceMemberRepository spaceMemberRepository;
    private final AuditLogRepository auditLogRepository;
    private final WebSocketRoomHandler webSocketRoomHandler;

    public List<TransactionDto.TransactionResponse> getTransactions(String spaceId, String categoryId) {
        List<Transaction> transactions = transactionRepository.filterTransactions(spaceId, categoryId);
        List<String> txIds = transactions.stream().map(Transaction::getId).collect(Collectors.toList());

        List<SplitDetail> allSplits = txIds.isEmpty() ? Collections.emptyList() : splitDetailRepository.findByTransactionIdIn(txIds);
        Map<String, List<SplitDetail>> splitMap = allSplits.stream().collect(Collectors.groupingBy(SplitDetail::getTransactionId));

        return transactions.stream().map(tx -> toTransactionResponse(tx, splitMap.getOrDefault(tx.getId(), Collections.emptyList()))).collect(Collectors.toList());
    }

    @Transactional
    public TransactionDto.TransactionResponse createTransaction(String userId, String spaceId, TransactionDto.TransactionRequest req) {
        if (req.getAmount() == null || req.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Số tiền giao dịch phải lớn hơn 0");
        }

        String txId = "tx-" + UUID.randomUUID().toString().substring(0, 8);
        Transaction tx = Transaction.builder()
                .id(txId)
                .spaceId(spaceId)
                .amount(req.getAmount())
                .description(req.getDescription() != null ? req.getDescription() : "Giao dịch chi tiêu")
                .categoryId(req.getCategory() != null ? req.getCategory() : "other")
                .transactionDate(req.getDate() != null ? OffsetDateTime.parse(req.getDate()) : OffsetDateTime.now())
                .paidBy(req.getPaidBy() != null ? req.getPaidBy() : userId)
                .splitType(req.getSplitType() != null ? req.getSplitType() : "SPLIT_EQUAL")
                .isSettlement(req.getIsSettlement() != null ? req.getIsSettlement() : false)
                .isDeleted(false)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();

        transactionRepository.save(tx);

        List<SplitDetail> splits = saveSplitDetails(tx, req.getSplits());

        // Audit Log
        AuditLog auditLog = AuditLog.builder()
                .id("audit-" + UUID.randomUUID().toString().substring(0, 8))
                .transactionId(txId)
                .userId(userId)
                .actionType("CREATED")
                .description("Đã tạo giao dịch: " + tx.getDescription())
                .createdAt(OffsetDateTime.now())
                .build();
        auditLogRepository.save(auditLog);

        TransactionDto.TransactionResponse response = toTransactionResponse(tx, splits);

        // Broadcast WS event
        Map<String, Object> wsMsg = Map.of(
            "type", "TRANSACTION_CREATED",
            "spaceId", spaceId,
            "transaction", response
        );
        webSocketRoomHandler.broadcastToSpace(spaceId, wsMsg);

        return response;
    }

    @Transactional
    public TransactionDto.TransactionResponse updateTransaction(String userId, String spaceId, String txId, TransactionDto.TransactionRequest req) {
        Transaction tx = transactionRepository.findById(txId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy giao dịch"));

        if (req.getAmount() != null) tx.setAmount(req.getAmount());
        if (req.getDescription() != null) tx.setDescription(req.getDescription());
        if (req.getCategory() != null) tx.setCategoryId(req.getCategory());
        if (req.getDate() != null) tx.setTransactionDate(OffsetDateTime.parse(req.getDate()));
        if (req.getPaidBy() != null) tx.setPaidBy(req.getPaidBy());
        if (req.getSplitType() != null) tx.setSplitType(req.getSplitType());

        transactionRepository.save(tx);

        splitDetailRepository.deleteByTransactionId(txId);
        List<SplitDetail> splits = saveSplitDetails(tx, req.getSplits());

        // Audit Log
        AuditLog auditLog = AuditLog.builder()
                .id("audit-" + UUID.randomUUID().toString().substring(0, 8))
                .transactionId(txId)
                .userId(userId)
                .actionType("EDITED")
                .description("Đã cập nhật giao dịch: " + tx.getDescription())
                .createdAt(OffsetDateTime.now())
                .build();
        auditLogRepository.save(auditLog);

        TransactionDto.TransactionResponse response = toTransactionResponse(tx, splits);

        Map<String, Object> wsMsg = Map.of(
            "type", "TRANSACTION_UPDATED",
            "spaceId", spaceId,
            "transaction", response
        );
        webSocketRoomHandler.broadcastToSpace(spaceId, wsMsg);

        return response;
    }

    @Transactional
    public void deleteTransaction(String userId, String spaceId, String txId) {
        Transaction tx = transactionRepository.findById(txId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy giao dịch"));

        tx.setIsDeleted(true);
        transactionRepository.save(tx);

        AuditLog auditLog = AuditLog.builder()
                .id("audit-" + UUID.randomUUID().toString().substring(0, 8))
                .transactionId(txId)
                .userId(userId)
                .actionType("DELETED")
                .description("Đã xóa giao dịch: " + tx.getDescription())
                .createdAt(OffsetDateTime.now())
                .build();
        auditLogRepository.save(auditLog);

        Map<String, Object> wsMsg = Map.of(
            "type", "TRANSACTION_DELETED",
            "spaceId", spaceId,
            "transactionId", txId
        );
        webSocketRoomHandler.broadcastToSpace(spaceId, wsMsg);
    }

    private List<SplitDetail> saveSplitDetails(Transaction tx, List<TransactionDto.SplitDetailDto> customSplits) {
        List<User> members = spaceMemberRepository.findUsersBySpaceId(tx.getSpaceId());
        if (members.isEmpty()) return Collections.emptyList();

        List<SplitDetail> splitsToSave = new ArrayList<>();

        if ("SPLIT_EXACT".equals(tx.getSplitType()) && customSplits != null && !customSplits.isEmpty()) {
            for (TransactionDto.SplitDetailDto s : customSplits) {
                BigDecimal owed = s.getOwedAmount() != null ? s.getOwedAmount() : BigDecimal.ZERO;
                BigDecimal pct = tx.getAmount().compareTo(BigDecimal.ZERO) > 0
                        ? owed.multiply(new BigDecimal(100)).divide(tx.getAmount(), 2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;

                splitsToSave.add(SplitDetail.builder()
                        .id("split-" + UUID.randomUUID().toString().substring(0, 8))
                        .transactionId(tx.getId())
                        .userId(s.getUserId())
                        .owedAmount(owed)
                        .percentage(pct)
                        .createdAt(OffsetDateTime.now())
                        .build());
            }
        } else if ("SPLIT_PERCENTAGE".equals(tx.getSplitType()) && customSplits != null && !customSplits.isEmpty()) {
            for (TransactionDto.SplitDetailDto s : customSplits) {
                BigDecimal pct = s.getPercentage() != null ? s.getPercentage() : BigDecimal.ZERO;
                BigDecimal owed = tx.getAmount().multiply(pct).divide(new BigDecimal(100), 2, RoundingMode.HALF_UP);

                splitsToSave.add(SplitDetail.builder()
                        .id("split-" + UUID.randomUUID().toString().substring(0, 8))
                        .transactionId(tx.getId())
                        .userId(s.getUserId())
                        .owedAmount(owed)
                        .percentage(pct)
                        .createdAt(OffsetDateTime.now())
                        .build());
            }
        } else {
            // Default SPLIT_EQUAL
            int count = members.size();
            BigDecimal equalShare = tx.getAmount().divide(new BigDecimal(count), 2, RoundingMode.HALF_UP);
            BigDecimal equalPct = new BigDecimal(100).divide(new BigDecimal(count), 2, RoundingMode.HALF_UP);

            for (User member : members) {
                splitsToSave.add(SplitDetail.builder()
                        .id("split-" + UUID.randomUUID().toString().substring(0, 8))
                        .transactionId(tx.getId())
                        .userId(member.getId())
                        .owedAmount(equalShare)
                        .percentage(equalPct)
                        .createdAt(OffsetDateTime.now())
                        .build());
            }
        }

        return splitDetailRepository.saveAll(splitsToSave);
    }

    public TransactionDto.TransactionResponse toTransactionResponse(Transaction tx, List<SplitDetail> splits) {
        List<TransactionDto.SplitDetailDto> splitDtos = splits.stream().map(s -> new TransactionDto.SplitDetailDto(
                s.getUserId(), s.getOwedAmount(), s.getPercentage()
        )).collect(Collectors.toList());

        return TransactionDto.TransactionResponse.builder()
                .id(tx.getId())
                .spaceId(tx.getSpaceId())
                .amount(tx.getAmount())
                .description(tx.getDescription())
                .category(tx.getCategoryId())
                .date(tx.getTransactionDate() != null ? tx.getTransactionDate().toString() : null)
                .paidBy(tx.getPaidBy())
                .splitType(tx.getSplitType())
                .isSettlement(tx.getIsSettlement())
                .splitDetails(splitDtos)
                .splits(splitDtos)
                .createdAt(tx.getCreatedAt() != null ? tx.getCreatedAt().toString() : null)
                .updatedAt(tx.getUpdatedAt() != null ? tx.getUpdatedAt().toString() : null)
                .build();
    }
}
