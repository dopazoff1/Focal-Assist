package com.crdpls.api.models;

import jakarta.persistence.*;

@Entity
@Table(name = "kb_map_edges")
public class KbMapEdge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "article_id", nullable = false)
    private KbArticle article;

    @Column(name = "source_node_id", nullable = false)
    private Long sourceNodeId;

    @Column(name = "target_node_id", nullable = false)
    private Long targetNodeId;

    private String label;

    @Column(name = "display_order")
    private Integer displayOrder;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public KbArticle getArticle() { return article; }
    public void setArticle(KbArticle article) { this.article = article; }

    public Long getSourceNodeId() { return sourceNodeId; }
    public void setSourceNodeId(Long sourceNodeId) { this.sourceNodeId = sourceNodeId; }

    public Long getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(Long targetNodeId) { this.targetNodeId = targetNodeId; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
}
