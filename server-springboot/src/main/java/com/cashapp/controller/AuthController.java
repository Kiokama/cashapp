package com.cashapp.controller;

import com.cashapp.dto.AuthDto;
import com.cashapp.model.User;
import com.cashapp.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/auth/register")
    public ResponseEntity<AuthDto.AuthResponse> register(@RequestBody AuthDto.RegisterRequest req) {
        return ResponseEntity.ok(authService.register(req));
    }

    @PostMapping("/auth/login")
    public ResponseEntity<AuthDto.AuthResponse> login(@RequestBody AuthDto.LoginRequest req) {
        return ResponseEntity.ok(authService.login(req));
    }

    @PostMapping("/auth/quick-login")
    public ResponseEntity<AuthDto.AuthResponse> quickLogin(@RequestBody AuthDto.QuickLoginRequest req) {
        return ResponseEntity.ok(authService.quickLogin(req));
    }

    @GetMapping("/users/me")
    public ResponseEntity<AuthDto.UserDto> getProfile(@AuthenticationPrincipal User authUser) {
        String userId = authUser != null ? authUser.getId() : "user-minhanh";
        return ResponseEntity.ok(authService.getCurrentUserProfile(userId));
    }

    @PutMapping("/users/me")
    public ResponseEntity<AuthDto.UserDto> updateProfile(@AuthenticationPrincipal User authUser, @RequestBody Map<String, Object> body) {
        String userId = authUser != null ? authUser.getId() : "user-minhanh";
        return ResponseEntity.ok(authService.updateProfile(userId, body));
    }
}
