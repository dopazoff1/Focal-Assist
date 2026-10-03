package com.focal.api.dto;

import java.util.ArrayList;
import java.util.List;

public class CrmQueueGroupDto {
    private String queueName;
    private List<CrmCaseDto> tickets = new ArrayList<>();

    public String getQueueName() {
        return queueName;
    }

    public void setQueueName(String queueName) {
        this.queueName = queueName;
    }

    public List<CrmCaseDto> getTickets() {
        return tickets;
    }

    public void setTickets(List<CrmCaseDto> tickets) {
        this.tickets = tickets;
    }
}
