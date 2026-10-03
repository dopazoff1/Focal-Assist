package com.focal.api.service;

import com.focal.api.dto.PresenceStatusHistoryDto;
import com.focal.api.models.User;
import com.focal.api.models.UserStatus;
import com.focal.api.models.UserStatusHistory;
import com.focal.api.repository.UserStatusHistoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PresenceTimelineService {

    private final UserStatusHistoryRepository historyRepository;

    public PresenceTimelineService(UserStatusHistoryRepository historyRepository) {
        this.historyRepository = historyRepository;
    }

    @Transactional
    public void record(User user, String status, String changedByEmail, String source, String note) {
        if (user == null) {
            return;
        }
        UserStatusHistory event = new UserStatusHistory();
        event.setUser(user);
        event.setStatus(UserStatus.normalize(status));
        event.setChangedByEmail(changedByEmail);
        event.setChangeSource(source == null || source.isBlank() ? "SYSTEM" : source.trim().toUpperCase());
        event.setNote(note);
        historyRepository.save(event);
    }

    @Transactional(readOnly = true)
    public List<PresenceStatusHistoryDto> list(Long userId) {
        List<UserStatusHistory> rows = userId == null
            ? historyRepository.findTop200ByOrderByChangedAtDescIdDesc()
            : historyRepository.findTop200ByUserIdOrderByChangedAtDescIdDesc(userId);
        return rows.stream().map(this::toDto).toList();
    }

    private PresenceStatusHistoryDto toDto(UserStatusHistory row) {
        User user = row.getUser();
        String userName = user == null
            ? "Unknown"
            : ((user.getFirstName() == null ? "" : user.getFirstName()) + " " + (user.getLastName() == null ? "" : user.getLastName())).trim();

        return new PresenceStatusHistoryDto(
            row.getId(),
            user == null ? null : user.getId(),
            userName,
            row.getStatus(),
            row.getChangedAt(),
            row.getChangedByEmail(),
            row.getChangeSource(),
            row.getNote()
        );
    }
}
