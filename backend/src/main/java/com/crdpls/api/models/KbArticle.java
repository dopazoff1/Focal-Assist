package com.crdpls.api.models;

import jakarta.persistence.*;

@Entity
@Table(name = "kb_articles")
public class KbArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String content;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private KbCategory category;

    // ===== Getters & Setters =====
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public Integer getDisplayOrder() { return displayOrder; }
    public Boolean getIsActive() { return isActive; }
    public KbCategory getCategory() { return category; }

    public void setId(Long id) { this.id = id; }
    public void setTitle(String title) { this.title = title; }
    public void setContent(String content) { this.content = content; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public void setCategory(KbCategory category) { this.category = category; }
}
