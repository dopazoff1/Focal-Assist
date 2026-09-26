package com.crdpls.api.repository;

public interface KbArticleSummaryProjection {
    Long getId();
    String getTitle();
    Integer getDisplayOrder();
    Boolean getIsActive();
    Long getCategoryId();
    String getCategoryName();
}
