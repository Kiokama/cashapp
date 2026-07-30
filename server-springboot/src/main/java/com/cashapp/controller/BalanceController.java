package com.cashapp.controller;

import com.cashapp.dto.AnalyticsDto;
import com.cashapp.dto.TransactionDto;
import com.cashapp.model.User;
import com.cashapp.service.BalanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/spaces/{spaceId}")
@RequiredArgsConstructor
public class BalanceController {

    private final BalanceService balanceService;

    @GetMapping("/balances")
    public ResponseEntity<Map<String, Object>> getBalances(@PathVariable String spaceId) {
        return ResponseEntity.ok(balanceService.calculateBalances(spaceId));
    }

    @PostMapping("/settlements")
    public ResponseEntity<TransactionDto.TransactionResponse> createSettlement(
            @AuthenticationPrincipal User authUser,
            @PathVariable String spaceId,
            @RequestBody AnalyticsDto.SettlementRequest req) {
        String userId = authUser != null ? authUser.getId() : "user-minhanh";
        return ResponseEntity.ok(balanceService.createSettlement(userId, spaceId, req));
    }
}
