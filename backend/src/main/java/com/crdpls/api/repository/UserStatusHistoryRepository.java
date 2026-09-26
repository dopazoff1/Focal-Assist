package com.crdpls.api.repository;

import com.crdpls.api.models.UserStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserStatusHistoryRepository extends JpaRepository<UserStatusHistory, Long> {
    List<UserStatusHistory> findTop200ByOrderByChangedAtDescIdDesc();
    List<UserStatusHistory> findTop200ByUserIdOrderByChangedAtDescIdDesc(Long userId);
}
