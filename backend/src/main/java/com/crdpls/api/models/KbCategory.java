package com.crdpls.api.models;

import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "kb_categories")
public class KbCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @OneToMany(mappedBy = "category", fetch = FetchType.LAZY)
    private List<KbArticle> articles;

    // ===== Getters & Setters =====
    public Long getId() { return id; }
    public String getName() { return name; }
    public Integer getDisplayOrder() { return displayOrder; }
    public Boolean getIsActive() { return isActive; }

    public void setId(Long id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}
