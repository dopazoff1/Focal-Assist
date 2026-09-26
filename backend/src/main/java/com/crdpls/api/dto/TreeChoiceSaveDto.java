package com.crdpls.api.dto;

public class TreeChoiceSaveDto {
    private Long id;
    private String label;
    private Long targetPageId;
    private Integer displayOrder;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public Long getTargetPageId() { return targetPageId; }
    public void setTargetPageId(Long targetPageId) { this.targetPageId = targetPageId; }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
}
