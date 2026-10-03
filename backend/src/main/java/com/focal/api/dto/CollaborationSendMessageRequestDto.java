package com.focal.api.dto;

import java.util.List;

public class CollaborationSendMessageRequestDto {
    private String content;
    private String parentId;
    private List<Long> linkedArticleIds;

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getParentId() { return parentId; }
    public void setParentId(String parentId) { this.parentId = parentId; }

    public List<Long> getLinkedArticleIds() { return linkedArticleIds; }
    public void setLinkedArticleIds(List<Long> linkedArticleIds) { this.linkedArticleIds = linkedArticleIds; }
}

