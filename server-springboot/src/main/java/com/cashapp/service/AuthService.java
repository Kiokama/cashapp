package com.cashapp.service;

import com.cashapp.dto.AuthDto;
import com.cashapp.model.Space;
import com.cashapp.model.SpaceMember;
import com.cashapp.model.SpaceMemberId;
import com.cashapp.model.User;
import com.cashapp.repository.SpaceMemberRepository;
import com.cashapp.repository.SpaceRepository;
import com.cashapp.repository.UserRepository;
import com.cashapp.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final SpaceRepository spaceRepository;
    private final SpaceMemberRepository spaceMemberRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    @Transactional
    public AuthDto.AuthResponse register(AuthDto.RegisterRequest req) {
        if (req.getEmail() == null || req.getEmail().trim().isEmpty()) {
            throw new IllegalArgumentException("Email không được để trống");
        }

        Optional<User> existing = userRepository.findByEmailIgnoreCase(req.getEmail().trim());
        if (existing.isPresent()) {
            throw new IllegalArgumentException("Email này đã được sử dụng");
        }

        String userId = "user-" + UUID.randomUUID().toString().substring(0, 8);
        User user = User.builder()
                .id(userId)
                .email(req.getEmail().trim().toLowerCase())
                .passwordHash(req.getPassword() != null ? passwordEncoder.encode(req.getPassword()) : null)
                .fullName(req.getName() != null ? req.getName() : "Người dùng")
                .avatarUrl("https://api.dicebear.com/7.x/avataaars/svg?seed=" + userId)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();

        userRepository.save(user);

        // Auto create default space for user
        createDefaultSpaceForUser(user);

        String token = tokenProvider.generateToken(userId);
        return AuthDto.AuthResponse.builder()
                .status("success")
                .token(token)
                .user(toUserDto(user))
                .build();
    }

    @Transactional
    public AuthDto.AuthResponse login(AuthDto.LoginRequest req) {
        String email = req.getEmail() != null ? req.getEmail().trim().toLowerCase() : "";
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("Email hoặc mật khẩu không chính xác"));

        String token = tokenProvider.generateToken(user.getId());
        return AuthDto.AuthResponse.builder()
                .status("success")
                .token(token)
                .user(toUserDto(user))
                .build();
    }

    @Transactional
    public AuthDto.AuthResponse quickLogin(AuthDto.QuickLoginRequest req) {
        String account = req.getAccount() != null ? req.getAccount().toLowerCase() : "minhanh";

        Map<String, User> devUsers = Map.of(
            "minhanh", User.builder().id("user-minhanh").email("minhanh@cashapp.com").fullName("Minh Anh").avatarUrl("https://api.dicebear.com/7.x/avataaars/svg?seed=MinhAnh").build(),
            "thuylinh", User.builder().id("user-thuylinh").email("thuylinh@cashapp.com").fullName("Thùy Linh").avatarUrl("https://api.dicebear.com/7.x/avataaars/svg?seed=ThuyLinh").build(),
            "demo", User.builder().id("user-demo").email("demo@cashapp.com").fullName("Khách Trải Nghiệm").avatarUrl("https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser").build()
        );

        User target = devUsers.getOrDefault(account, devUsers.get("minhanh"));

        // Upsert user
        User user = userRepository.findById(target.getId()).orElse(target);
        user.setFullName(target.getFullName());
        user.setAvatarUrl(target.getAvatarUrl());
        user.setEmail(target.getEmail());
        userRepository.save(user);

        // Ensure default couple space
        String spaceId = "space-demo-couple";
        if (!spaceRepository.existsById(spaceId)) {
            Space space = Space.builder()
                    .id(spaceId)
                    .name("Không gian thương & yêu 💕")
                    .emoji("💕")
                    .inviteCode("LOVE2026")
                    .createdBy("user-minhanh")
                    .createdAt(OffsetDateTime.now())
                    .updatedAt(OffsetDateTime.now())
                    .build();
            spaceRepository.save(space);
        }

        // Add user to space
        SpaceMemberId memberId = new SpaceMemberId(spaceId, user.getId());
        if (!spaceMemberRepository.existsById(memberId)) {
            SpaceMember member = SpaceMember.builder()
                    .id(memberId)
                    .role("ADMIN")
                    .joinedAt(OffsetDateTime.now())
                    .build();
            spaceMemberRepository.save(member);
        }

        String token = tokenProvider.generateToken(user.getId());
        return AuthDto.AuthResponse.builder()
                .status("success")
                .token(token)
                .user(toUserDto(user))
                .build();
    }

    public AuthDto.UserDto getCurrentUserProfile(String userId) {
        User user = userRepository.findById(userId)
                .orElseGet(() -> userRepository.findAll().stream().findFirst()
                        .orElse(User.builder().id("user-minhanh").fullName("Minh Anh").email("minhanh@cashapp.com").build()));
        return toUserDto(user);
    }

    @Transactional
    public AuthDto.UserDto updateProfile(String userId, Map<String, Object> body) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng"));

        if (body.containsKey("name")) user.setFullName((String) body.get("name"));
        if (body.containsKey("email")) user.setEmail((String) body.get("email"));
        if (body.containsKey("avatar")) user.setAvatarUrl((String) body.get("avatar"));

        userRepository.save(user);
        return toUserDto(user);
    }

    private void createDefaultSpaceForUser(User user) {
        String spaceId = "space-" + UUID.randomUUID().toString().substring(0, 8);
        Space space = Space.builder()
                .id(spaceId)
                .name("Không gian của " + user.getFullName())
                .emoji("🏠")
                .inviteCode(UUID.randomUUID().toString().substring(0, 6).toUpperCase())
                .createdBy(user.getId())
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
        spaceRepository.save(space);

        SpaceMember member = SpaceMember.builder()
                .id(new SpaceMemberId(spaceId, user.getId()))
                .role("ADMIN")
                .joinedAt(OffsetDateTime.now())
                .build();
        spaceMemberRepository.save(member);
    }

    public AuthDto.UserDto toUserDto(User user) {
        return AuthDto.UserDto.builder()
                .id(user.getId())
                .name(user.getFullName())
                .email(user.getEmail())
                .avatar(user.getAvatarUrl())
                .build();
    }
}
