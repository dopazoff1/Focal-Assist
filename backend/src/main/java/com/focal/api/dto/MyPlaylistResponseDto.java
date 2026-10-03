package com.focal.api.dto;

import java.util.ArrayList;
import java.util.List;

public class MyPlaylistResponseDto {
    private CrmCaseDto oldestCase;
    private List<CrmCaseDto> cases = new ArrayList<>();

    public CrmCaseDto getOldestCase() {
        return oldestCase;
    }

    public void setOldestCase(CrmCaseDto oldestCase) {
        this.oldestCase = oldestCase;
    }

    public List<CrmCaseDto> getCases() {
        return cases;
    }

    public void setCases(List<CrmCaseDto> cases) {
        this.cases = cases;
    }
}
