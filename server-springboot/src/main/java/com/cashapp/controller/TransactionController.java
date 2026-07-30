package com.cashapp.controller;

import com.cashapp.dto.TransactionDto;
import com.cashapp.model.User;
import com.cashapp.service.TransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/spaces/{spaceId}/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;

    @GetMapping
    public ResponseEntity<List<TransactionDto.TransactionResponse>> getTransactions(
            @PathVariable String spaceId,
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(transactionService.getTransactions(spaceId, category));
    }

    @PostMapping
    public ResponseEntity<TransactionDto.TransactionResponse> createTransaction(
            @AuthenticationPrincipal User authUser,
            @PathVariable String spaceId,
            @RequestBody TransactionDto.TransactionRequest req) {
        String userId = authUser != null ? authUser.getId() : "user-minhanh";
        return ResponseEntity.ok(transactionService.createTransaction(userId, spaceId, req));
    }

    @PutMapping("/{transactionId}")
    public ResponseEntity<TransactionDto.TransactionResponse> updateTransaction(
            @AuthenticationPrincipal User authUser,
            @PathVariable String spaceId,
            @PathVariable String transactionId,
            @RequestBody TransactionDto.TransactionRequest req) {
        String userId = authUser != null ? authUser.getId() : "user-minhanh";
        return ResponseEntity.ok(transactionService.updateTransaction(userId, spaceId, transactionId, req));
    }

    @DeleteMapping("/{transactionId}")
    public ResponseEntity<Map<String, Boolean>> deleteTransaction(
            @AuthenticationPrincipal User authUser,
            @PathVariable String spaceId,
            @PathVariable String transactionId) {
        String userId = authUser != null ? authUser.getId() : "user-minhanh";
        transactionService.deleteTransaction(userId, spaceId, transactionId);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
