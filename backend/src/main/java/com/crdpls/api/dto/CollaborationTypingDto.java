package com.crdpls.api.dto;

import java.util.ArrayList;
import java.util.List;

public class CollaborationTypingDto {
    private List<Long> typingUserIds = new ArrayList<>();

    public List<Long> getTypingUserIds() {
        return typingUserIds;
    }

    public void setTypingUserIds(List<Long> typingUserIds) {
        this.typingUserIds = typingUserIds == null ? new ArrayList<>() : new ArrayList<>(typingUserIds);
    }
}

