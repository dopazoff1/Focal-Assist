package com.crdpls.api.dto;

public class EscalationAssignL2RequestDto {
    private Long l2AssigneeUserId;
    private String l2AssigneeName;

    public Long getL2AssigneeUserId() {
        return l2AssigneeUserId;
    }

    public void setL2AssigneeUserId(Long l2AssigneeUserId) {
        this.l2AssigneeUserId = l2AssigneeUserId;
    }

    public String getL2AssigneeName() {
        return l2AssigneeName;
    }

    public void setL2AssigneeName(String l2AssigneeName) {
        this.l2AssigneeName = l2AssigneeName;
    }
}

