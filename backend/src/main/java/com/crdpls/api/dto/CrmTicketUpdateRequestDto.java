package com.crdpls.api.dto;

import java.util.List;

public class CrmTicketUpdateRequestDto {
    private String status;
    private String reply;
    private List<Long> tagNodeIds;

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReply() {
        return reply;
    }

    public void setReply(String reply) {
        this.reply = reply;
    }

    public List<Long> getTagNodeIds() {
        return tagNodeIds;
    }

    public void setTagNodeIds(List<Long> tagNodeIds) {
        this.tagNodeIds = tagNodeIds;
    }
}
