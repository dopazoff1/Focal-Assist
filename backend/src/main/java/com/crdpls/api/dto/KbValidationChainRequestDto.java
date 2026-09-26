package com.crdpls.api.dto;

import java.util.List;

public class KbValidationChainRequestDto {
    private List<Long> reviewerUserIds;

    public List<Long> getReviewerUserIds() { return reviewerUserIds; }
    public void setReviewerUserIds(List<Long> reviewerUserIds) { this.reviewerUserIds = reviewerUserIds; }
}
