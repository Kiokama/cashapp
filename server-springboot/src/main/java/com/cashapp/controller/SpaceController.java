package com.cashapp.controller;

import com.cashapp.dto.SpaceDto;
import com.cashapp.model.Space;
import com.cashapp.model.User;
import com.cashapp.service.SpaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/spaces")
@RequiredArgsConstructor
public class SpaceController {

    private final SpaceService spaceService;

    @GetMapping
    public ResponseEntity<List<SpaceDto.SpaceResponse>> getUserSpaces(@AuthenticationPrincipal User authUser) {
        String userId = authUser != null ? authUser.getId() : "user-minhanh";
        return ResponseEntity.ok(spaceService.getUserSpaces(userId));
    }

    @PostMapping
    public ResponseEntity<SpaceDto.SpaceResponse> createSpace(@AuthenticationPrincipal User authUser, @RequestBody SpaceDto.CreateSpaceRequest req) {
        String userId = authUser != null ? authUser.getId() : "user-minhanh";
        Space space = spaceService.createSpace(userId, req.getName(), req.getEmoji());
        return ResponseEntity.ok(spaceService.toSpaceResponse(space));
    }

    @PostMapping("/join")
    public ResponseEntity<SpaceDto.SpaceResponse> joinSpace(@AuthenticationPrincipal User authUser, @RequestBody SpaceDto.JoinSpaceRequest req) {
        String userId = authUser != null ? authUser.getId() : "user-minhanh";
        return ResponseEntity.ok(spaceService.joinSpace(userId, req.getInviteCode()));
    }

    @GetMapping("/{spaceId}")
    public ResponseEntity<SpaceDto.SpaceResponse> getSpaceById(@PathVariable String spaceId) {
        return ResponseEntity.ok(spaceService.getSpaceById(spaceId));
    }

    @PostMapping("/{spaceId}/leave")
    public ResponseEntity<Map<String, Boolean>> leaveSpace(@PathVariable String spaceId) {
        return ResponseEntity.ok(Map.of("success", true));
    }
}
