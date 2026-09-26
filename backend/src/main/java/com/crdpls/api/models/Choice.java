package com.crdpls.api.models;

import jakarta.persistence.*;

@Entity
@Table(name = "choices")
public class Choice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String label;

    @Column(name = "source_page_id")
    private Long sourcePageId;

    @Column(name = "target_page_id")
    private Long targetPageId;

    private Integer displayOrder;

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public Long getSourcePageId() { return sourcePageId; }
    public void setSourcePageId(Long sourcePageId) { this.sourcePageId = sourcePageId; }

    public Long getTargetPageId() { return targetPageId; }
    public void setTargetPageId(Long targetPageId) { this.targetPageId = targetPageId; }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
}
