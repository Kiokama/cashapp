package com.cashapp.controller;

import com.cashapp.dto.AnalyticsDto;
import com.cashapp.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/spaces/{spaceId}")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/analytics/category-summary")
    public ResponseEntity<List<AnalyticsDto.CategorySummaryItem>> getCategorySummary(@PathVariable String spaceId) {
        return ResponseEntity.ok(analyticsService.getCategorySummary(spaceId));
    }

    @GetMapping("/analytics/trend")
    public ResponseEntity<List<AnalyticsDto.TrendItem>> getTrend(@PathVariable String spaceId) {
        return ResponseEntity.ok(analyticsService.getTrend(spaceId));
    }

    @GetMapping("/budgets")
    public ResponseEntity<Map<String, BigDecimal>> getBudgets(@PathVariable String spaceId) {
        return ResponseEntity.ok(analyticsService.getBudgets(spaceId));
    }

    @PutMapping("/budgets/{categoryId}")
    public ResponseEntity<Map<String, BigDecimal>> updateBudget(
            @PathVariable String spaceId,
            @PathVariable String categoryId,
            @RequestBody Map<String, Object> body) {
        Object val = body.get("amount") != null ? body.get("amount") : body.get("monthlyLimit");
        BigDecimal limit = val != null ? new BigDecimal(val.toString()) : BigDecimal.ZERO;
        return ResponseEntity.ok(analyticsService.updateBudget(spaceId, categoryId, limit));
    }
}
