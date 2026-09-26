package com.crdpls.api.service;

import com.crdpls.api.models.KbCategory;
import com.crdpls.api.repository.KbCategoryRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class KbCategoryService {

    private final KbCategoryRepository categoryRepository;

    public KbCategoryService(KbCategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public List<KbCategory> getAllActiveCategories() {
        return categoryRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
    }
}
