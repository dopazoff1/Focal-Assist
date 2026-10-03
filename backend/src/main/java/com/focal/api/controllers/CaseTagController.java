package com.focal.api.controllers;

import com.focal.api.dto.CaseTagMapResponseDto;
import com.focal.api.dto.CaseTagMapSaveRequestDto;
import com.focal.api.service.CaseTagService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/case-tags")
@CrossOrigin
public class CaseTagController {

    private final CaseTagService caseTagService;

    public CaseTagController(CaseTagService caseTagService) {
        this.caseTagService = caseTagService;
    }

    @GetMapping({"/map", "/tree"})
    public CaseTagMapResponseDto getMap() {
        return caseTagService.getMap();
    }

    @RequestMapping(path = {"/map/save", "/map"}, method = {RequestMethod.POST, RequestMethod.PUT})
    public Map<String, Object> saveMap(@RequestBody CaseTagMapSaveRequestDto request) {
        return caseTagService.saveMap(request);
    }
}
