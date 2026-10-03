package com.focal.api.dto;

import java.util.List;

public class KbArticleDraftRequestDto {
    private Long categoryId;
    private String title;
    private String content;
    private Integer displayOrder;
    private Boolean requestedActive;
    private List<Long> validatorUserIds;

    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
    public Boolean getRequestedActive() { return requestedActive; }
    public void setRequestedActive(Boolean requestedActive) { this.requestedActive = requestedActive; }
    public List<Long> getValidatorUserIds() { return validatorUserIds; }
    public void setValidatorUserIds(List<Long> validatorUserIds) { this.validatorUserIds = validatorUserIds; }
}
