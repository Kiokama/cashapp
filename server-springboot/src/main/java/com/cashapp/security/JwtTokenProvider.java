package com.cashapp.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.util.Date;

@Component
public class JwtTokenProvider {

    @Value("${app.jwt.expiration-ms:604800000}")
    private long jwtExpirationMs;

    public String generateToken(String userId) {
        return "jwt_access_token_" + userId + "_" + System.currentTimeMillis();
    }

    public String getUserIdFromToken(String token) {
        if (token == null) return null;
        if (token.startsWith("Bearer ")) {
            token = token.substring(7);
        }
        if (token.startsWith("jwt_access_token_")) {
            String[] parts = token.split("_");
            if (parts.length >= 4) {
                return parts[3];
            }
        }
        return token;
    }

    public boolean validateToken(String token) {
        return token != null && !token.trim().isEmpty();
    }
}
