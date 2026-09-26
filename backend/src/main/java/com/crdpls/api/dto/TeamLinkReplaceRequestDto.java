package com.crdpls.api.dto;

import java.util.ArrayList;
import java.util.List;

public class TeamLinkReplaceRequestDto {
    private String managerRole;
    private Long managerId;
    private List<Long> agentIds = new ArrayList<>();

    public String getManagerRole() {
        return managerRole;
    }

    public void setManagerRole(String managerRole) {
        this.managerRole = managerRole;
    }

    public Long getManagerId() {
        return managerId;
    }

    public void setManagerId(Long managerId) {
        this.managerId = managerId;
    }

    public List<Long> getAgentIds() {
        return agentIds;
    }

    public void setAgentIds(List<Long> agentIds) {
        this.agentIds = agentIds;
    }
}
