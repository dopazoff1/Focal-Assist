package com.crdpls.api.controllers;

import com.crdpls.api.dto.TreeSaveRequestDto;
import com.crdpls.api.models.Page;
import com.crdpls.api.service.PageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pages")
public class PageController {

    @Autowired
    private PageService pageService;

    @GetMapping
    public List<Page> getAllPages() {
        return pageService.getAllPagesWithChoices();
    }

    @GetMapping("/{id}")
    public Page getPage(@PathVariable Long id) {
        return pageService.getPageWithChoices(id);
    }

    @PostMapping("/tree/save")
    public Map<String, Object> saveTree(@RequestBody TreeSaveRequestDto request) {
        return pageService.saveTree(request);
    }
}
