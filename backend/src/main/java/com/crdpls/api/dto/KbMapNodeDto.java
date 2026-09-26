package com.crdpls.api.dto;

public class KbMapNodeDto {
    private Long id;
    private Long articleId;
    private String title;
    private String label;
    private String content;
    private Integer xPos;
    private Integer yPos;
    private Boolean isStart;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getArticleId() { return articleId; }
    public void setArticleId(Long articleId) { this.articleId = articleId; }

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
