package com.crdpls.api.controllers;

import com.crdpls.api.models.KbCategory;
import com.crdpls.api.service.KbCategoryService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kb/categories")
@CrossOrigin
public class KbCategoryController {

    private final KbCategoryService categoryService;

    public KbCategoryController(KbCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public List<KbCategory> getCategories() {
        return categoryService.getAllActiveCategories();
    }
}
