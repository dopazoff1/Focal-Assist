package com.crdpls.api.controllers;

import com.crdpls.api.dto.KbHubIndexDto;
import com.crdpls.api.dto.KbHubSearchResultDto;
import com.crdpls.api.service.KbHubService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/kb/hub")
@CrossOrigin
public class KbHubController {

    private final KbHubService hubService;

    public KbHubController(KbHubService hubService) {
        this.hubService = hubService;
    }

    @GetMapping("/index")
    public KbHubIndexDto getIndex() {
        return hubService.getIndex();
    }

    @GetMapping("/search")
    public List<KbHubSearchResultDto> search(
            @RequestParam(name = "q", defaultValue = "") String query,
            @RequestParam(name = "limit", defaultValue = "7") int limit
    ) {
        return hubService.search(query, limit);
    }
}
