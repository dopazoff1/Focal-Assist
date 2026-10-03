package com.focal.api.models;

import jakarta.persistence.*;

@Entity
@Table(name = "kb_map_nodes")
public class KbMapNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "article_id", nullable = false)
    private KbArticle article;

    private String title;

    private String label;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String content;

    @Column(name = "x_pos")
    private Integer xPos;

    @Column(name = "y_pos")
    private Integer yPos;

    @Column(name = "is_start")
    private Boolean isStart = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public KbArticle getArticle() { return article; }
    public void setArticle(KbArticle article) { this.article = article; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public Integer getXPos() { return xPos; }
    public void setXPos(Integer xPos) { this.xPos = xPos; }

    public Integer getYPos() { return yPos; }
    public void setYPos(Integer yPos) { this.yPos = yPos; }

    public Boolean getIsStart() { return isStart; }
    public void setIsStart(Boolean isStart) { this.isStart = isStart; }
}
