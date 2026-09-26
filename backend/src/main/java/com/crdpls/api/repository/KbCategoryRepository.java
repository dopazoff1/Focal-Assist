package com.crdpls.api.repository;

import com.crdpls.api.models.KbCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KbCategoryRepository extends JpaRepository<KbCategory, Long> {

    List<KbCategory> findByIsActiveTrueOrderByDisplayOrderAsc();
}
