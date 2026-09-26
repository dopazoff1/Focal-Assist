package com.crdpls.api.dto;

public class EscalationJiraPatchRequestDto {
    private String jiraIssueKey;
    private String jiraIssueUrl;
    private String jiraStatus;
    private String jiraSyncedAt;

    public String getJiraIssueKey() {
        return jiraIssueKey;
    }

    public void setJiraIssueKey(String jiraIssueKey) {
        this.jiraIssueKey = jiraIssueKey;
    }

    public String getJiraIssueUrl() {
        return jiraIssueUrl;
    }

    public void setJiraIssueUrl(String jiraIssueUrl) {
        this.jiraIssueUrl = jiraIssueUrl;
    }

    public String getJiraStatus() {
        return jiraStatus;
    }

    public void setJiraStatus(String jiraStatus) {
        this.jiraStatus = jiraStatus;
    }

    public String getJiraSyncedAt() {
        return jiraSyncedAt;
    }

    public void setJiraSyncedAt(String jiraSyncedAt) {
        this.jiraSyncedAt = jiraSyncedAt;
    }
}

