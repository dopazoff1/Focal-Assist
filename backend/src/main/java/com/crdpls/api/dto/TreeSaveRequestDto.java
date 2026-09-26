package com.crdpls.api.dto;

import java.util.List;

public class TreeSaveRequestDto {
    private List<TreePageSaveDto> pages;

    public List<TreePageSaveDto> getPages() { return pages; }
    public void setPages(List<TreePageSaveDto> pages) { this.pages = pages; }
}
