package com.focal.api.dto;

public class TeamLinkReplaceForAgentRequestDto {
    private Long teamLeaderId;
    private Long qaId;

    public Long getTeamLeaderId() {
        return teamLeaderId;
    }

    public void setTeamLeaderId(Long teamLeaderId) {
        this.teamLeaderId = teamLeaderId;
    }

    public Long getQaId() {
        return qaId;
    }

    public void setQaId(Long qaId) {
        this.qaId = qaId;
    }
}
