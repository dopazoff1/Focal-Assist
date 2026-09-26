package com.crdpls.api.dto;

import java.util.List;

public class TreePageSaveDto {
    private Long id;
    private String name;
    private String content;
    private String tag;
    private Long prevPageId;
    private Boolean isStart;
    private List<TreeChoiceSaveDto> choices;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }

    public Long getPrevPageId() { return prevPageId; }
    public void setPrevPageId(Long prevPageId) { this.prevPageId = prevPageId; }

    public Boolean getIsStart() { return isStart; }
    public void setIsStart(Boolean isStart) { this.isStart = isStart; }

    public List<TreeChoiceSaveDto> getChoices() { return choices; }
    public void setChoices(List<TreeChoiceSaveDto> choices) { this.choices = choices; }
}
