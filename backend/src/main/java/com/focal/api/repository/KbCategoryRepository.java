package com.focal.api.repository;

import com.focal.api.models.KbCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KbCategoryRepository extends JpaRepository<KbCategory, Long> {

    List<KbCategory> findByIsActiveTrueOrderByDisplayOrderAsc();
}
