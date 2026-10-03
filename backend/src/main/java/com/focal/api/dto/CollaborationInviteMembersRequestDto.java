package com.focal.api.dto;

import java.util.List;

public class CollaborationInviteMembersRequestDto {
    private List<Long> memberIds;

    public List<Long> getMemberIds() {
        return memberIds;
    }

    public void setMemberIds(List<Long> memberIds) {
        this.memberIds = memberIds;
    }
}

