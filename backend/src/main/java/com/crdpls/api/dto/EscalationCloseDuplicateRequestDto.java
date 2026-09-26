package com.crdpls.api.dto;

public class EscalationCloseDuplicateRequestDto {
    private Long originalTicketId;
    private String note;

    public Long getOriginalTicketId() {
        return originalTicketId;
    }

    public void setOriginalTicketId(Long originalTicketId) {
        this.originalTicketId = originalTicketId;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}

