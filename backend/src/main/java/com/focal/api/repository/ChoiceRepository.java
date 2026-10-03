package com.focal.api.repository;

import com.focal.api.models.Choice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChoiceRepository extends JpaRepository<Choice, Long> {

    List<Choice> findBySourcePageIdOrderByDisplayOrderAsc(Long sourcePageId);

    void deleteBySourcePageId(Long sourcePageId);

    void deleteByTargetPageIdIn(List<Long> targetPageIds);
}
