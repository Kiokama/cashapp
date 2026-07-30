package com.cashapp.service;

import com.cashapp.dto.AnalyticsDto;
import com.cashapp.model.Budget;
import com.cashapp.model.Transaction;
import com.cashapp.repository.BudgetRepository;
import com.cashapp.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final TransactionRepository transactionRepository;
    private final BudgetRepository budgetRepository;

    public List<AnalyticsDto.CategorySummaryItem> getCategorySummary(String spaceId) {
        List<Transaction> transactions = transactionRepository.findBySpaceIdAndIsDeletedFalseOrderByTransactionDateDesc(spaceId);

        Map<String, BigDecimal> categorySums = new HashMap<>();
        for (Transaction tx : transactions) {
            if (Boolean.TRUE.equals(tx.getIsSettlement())) continue;
            String cat = tx.getCategoryId();
            categorySums.put(cat, categorySums.getOrDefault(cat, BigDecimal.ZERO).add(tx.getAmount()));
        }

        return categorySums.entrySet().stream()
                .map(e -> new AnalyticsDto.CategorySummaryItem(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    public List<AnalyticsDto.TrendItem> getTrend(String spaceId) {
        List<Transaction> transactions = transactionRepository.findBySpaceIdAndIsDeletedFalseOrderByTransactionDateDesc(spaceId);

        Map<String, BigDecimal> monthlySums = new LinkedHashMap<>();
        for (Transaction tx : transactions) {
            if (Boolean.TRUE.equals(tx.getIsSettlement())) continue;
            String monthKey = tx.getTransactionDate().getYear() + "-" + String.format("%02d", tx.getTransactionDate().getMonthValue());
            monthlySums.put(monthKey, monthlySums.getOrDefault(monthKey, BigDecimal.ZERO).add(tx.getAmount()));
        }

        return monthlySums.entrySet().stream()
                .map(e -> new AnalyticsDto.TrendItem(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    public Map<String, BigDecimal> getBudgets(String spaceId) {
        List<Budget> list = budgetRepository.findBySpaceId(spaceId);
        Map<String, BigDecimal> res = new HashMap<>();
        for (Budget b : list) {
            res.put(b.getCategoryId(), b.getMonthlyLimit());
        }
        return res;
    }

    @Transactional
    public Map<String, BigDecimal> updateBudget(String spaceId, String categoryId, BigDecimal limit) {
        Optional<Budget> existing = budgetRepository.findBySpaceIdAndCategoryId(spaceId, categoryId);
        Budget b;
        if (existing.isPresent()) {
            b = existing.get();
            b.setMonthlyLimit(limit);
        } else {
            b = Budget.builder()
                    .id("bg-" + UUID.randomUUID().toString().substring(0, 8))
                    .spaceId(spaceId)
                    .categoryId(categoryId)
                    .monthlyLimit(limit)
                    .createdAt(OffsetDateTime.now())
                    .updatedAt(OffsetDateTime.now())
                    .build();
        }
        budgetRepository.save(b);
        return getBudgets(spaceId);
    }
}
