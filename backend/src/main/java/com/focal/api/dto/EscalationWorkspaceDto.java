package com.focal.api.dto;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class EscalationWorkspaceDto {
    private List<EscalationTicketDto> tickets = new ArrayList<>();
    private Map<String, List<EscalationCommentDto>> commentsByTicket = new LinkedHashMap<>();

    public List<EscalationTicketDto> getTickets() {
        return tickets;
    }

    public void setTickets(List<EscalationTicketDto> tickets) {
        this.tickets = tickets;
    }

    public Map<String, List<EscalationCommentDto>> getCommentsByTicket() {
        return commentsByTicket;
    }

    public void setCommentsByTicket(Map<String, List<EscalationCommentDto>> commentsByTicket) {
        this.commentsByTicket = commentsByTicket;
    }
}

