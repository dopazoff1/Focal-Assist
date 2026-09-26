package com.crdpls.api.dto;

import java.util.List;

public class CollaborationLinkedArticlesRequestDto {
    private List<Long> articleIds;

    public List<Long> getArticleIds() {
        return articleIds;
    }

    public void setArticleIds(List<Long> articleIds) {
        this.articleIds = articleIds;
    }
}

