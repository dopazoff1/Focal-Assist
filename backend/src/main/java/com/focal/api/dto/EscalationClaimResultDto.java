package com.focal.api.dto;

public class EscalationClaimResultDto {
    private boolean ok;
    private EscalationTicketDto ticket;
    private String error;

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
    }

    public EscalationTicketDto getTicket() {
        return ticket;
    }

    public void setTicket(EscalationTicketDto ticket) {
        this.ticket = ticket;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}

