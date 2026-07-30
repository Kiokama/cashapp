package com.cashapp.service;

import com.cashapp.dto.AuthDto;
import com.cashapp.dto.SpaceDto;
import com.cashapp.model.Budget;
import com.cashapp.model.Space;
import com.cashapp.model.SpaceMember;
import com.cashapp.model.SpaceMemberId;
import com.cashapp.model.User;
import com.cashapp.repository.BudgetRepository;
import com.cashapp.repository.SpaceMemberRepository;
import com.cashapp.repository.SpaceRepository;
import com.cashapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SpaceService {

    private final SpaceRepository spaceRepository;
    private final SpaceMemberRepository spaceMemberRepository;
    private final UserRepository userRepository;
    private final BudgetRepository budgetRepository;
    private final AuthService authService;

    public List<SpaceDto.SpaceResponse> getUserSpaces(String userId) {
        List<Space> spaces = spaceRepository.findByUserId(userId);
        if (spaces.isEmpty()) {
            // Create default space if none found
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                Space space = createSpace(userId, "Không gian của " + user.getFullName(), "🏠");
                return List.of(toSpaceResponse(space));
            }
        }
        return spaces.stream().map(this::toSpaceResponse).collect(Collectors.toList());
    }

    @Transactional
    public Space createSpace(String userId, String name, String emoji) {
        String spaceId = "space-" + UUID.randomUUID().toString().substring(0, 8);
        Space space = Space.builder()
                .id(spaceId)
                .name(name != null ? name : "Không gian mới")
                .emoji(emoji != null ? emoji : "🏠")
                .inviteCode(UUID.randomUUID().toString().substring(0, 6).toUpperCase())
                .createdBy(userId)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();

        spaceRepository.save(space);

        SpaceMember member = SpaceMember.builder()
                .id(new SpaceMemberId(spaceId, userId))
                .role("ADMIN")
                .joinedAt(OffsetDateTime.now())
                .build();
        spaceMemberRepository.save(member);

        return space;
    }

    @Transactional
    public SpaceDto.SpaceResponse joinSpace(String userId, String inviteCode) {
        Space space = spaceRepository.findByInviteCodeIgnoreCase(inviteCode.trim())
                .orElseThrow(() -> new IllegalArgumentException("Mã mời không tồn tại"));

        SpaceMemberId memberId = new SpaceMemberId(space.getId(), userId);
        if (!spaceMemberRepository.existsById(memberId)) {
            SpaceMember member = SpaceMember.builder()
                    .id(memberId)
                    .role("MEMBER")
                    .joinedAt(OffsetDateTime.now())
                    .build();
            spaceMemberRepository.save(member);
        }

        return toSpaceResponse(space);
    }

    public SpaceDto.SpaceResponse getSpaceById(String spaceId) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy không gian chung"));
        return toSpaceResponse(space);
    }

    public SpaceDto.SpaceResponse toSpaceResponse(Space space) {
        List<User> members = spaceMemberRepository.findUsersBySpaceId(space.getId());
        List<String> memberIds = members.stream().map(User::getId).collect(Collectors.toList());
        List<AuthDto.UserDto> memberDetails = members.stream().map(authService::toUserDto).collect(Collectors.toList());

        List<Budget> budgets = budgetRepository.findBySpaceId(space.getId());
        Map<String, Object> budgetMap = new HashMap<>();
        for (Budget b : budgets) {
            budgetMap.put(b.getCategoryId(), b.getMonthlyLimit());
        }

        return SpaceDto.SpaceResponse.builder()
                .id(space.getId())
                .name(space.getName())
                .emoji(space.getEmoji())
                .inviteCode(space.getInviteCode())
                .createdBy(space.getCreatedBy())
                .members(memberIds)
                .memberDetails(memberDetails)
                .budgets(budgetMap)
                .createdAt(space.getCreatedAt() != null ? space.getCreatedAt().toString() : null)
                .build();
    }
}
