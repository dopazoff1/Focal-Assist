package com.crdpls.api.dto;

import java.util.ArrayList;
import java.util.List;

public class EscalationCreateTicketRequestDto {
    private String title;
    private String description;
    private String customerEmail;
    private String clientId;
    private List<String> issueTypes = new ArrayList<>();
    private String priority;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCustomerEmail() { return customerEmail; }
    public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public List<String> getIssueTypes() { return issueTypes; }
    public void setIssueTypes(List<String> issueTypes) { this.issueTypes = issueTypes; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
}

