package com.crdpls.api.service;

import com.crdpls.api.models.User;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Service
public class JiraBridgeService {

    private final RestTemplate restTemplate;

    public JiraBridgeService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(25000);
        this.restTemplate = new RestTemplate(factory);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> testConnection(User user) {
        return exchangeJson(user, HttpMethod.GET, "/rest/api/2/myself", null);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> createIssueFromTicket(User user, Map<String, Object> ticketPayload) {
        String key = safe(ticketPayload.get("key"));
        String title = safe(ticketPayload.get("title"));
        String customSummary = safe(ticketPayload.get("summary"));
        String priority = safe(ticketPayload.get("priority"));
        String createdByName = safe(ticketPayload.get("createdByName"));
        String createdByRole = safe(ticketPayload.get("createdByRole"));
        String customerEmail = safe(ticketPayload.get("customerEmail"));
        String clientId = safe(ticketPayload.get("clientId"));
        String escalationReason = safe(ticketPayload.get("escalationReason"));
        String description = safe(ticketPayload.get("description"));
        String payloadIssueType = safe(ticketPayload.get("issueTypeName"));
        String payloadProjectKey = safe(ticketPayload.get("projectKey")).toUpperCase();

        String summary = customSummary;
        if (summary.isBlank()) {
            String summaryPrefix = key.isBlank() ? "" : "[" + key + "] ";
            summary = (summaryPrefix + (title.isBlank() ? "Escalation ticket" : title));
        }
        if (summary.length() > 240) {
            summary = summary.substring(0, 240);
        }

        StringBuilder body = new StringBuilder();
        if (!key.isBlank()) body.append("Escalation Ticket: ").append(key).append('\n');
        if (!priority.isBlank()) body.append("Priority: ").append(priority).append('\n');
        if (!createdByName.isBlank() || !createdByRole.isBlank()) {
            body.append("Created By: ").append(createdByName);
            if (!createdByRole.isBlank()) body.append(" (").append(createdByRole).append(")");
            body.append('\n');
        }
        if (!customerEmail.isBlank()) body.append("Customer: ").append(customerEmail).append('\n');
        if (!clientId.isBlank()) body.append("Client ID: ").append(clientId).append('\n');
        if (!escalationReason.isBlank()) body.append("Escalation Reason: ").append(escalationReason).append('\n');
        body.append('\n');
        body.append(description.isBlank() ? "(No description)" : description);

        String issueType = payloadIssueType.isBlank() ? safe(user.getJiraIssueTypeName()) : payloadIssueType;
        if (issueType.isBlank()) issueType = "Task";
        String projectKey = payloadProjectKey.isBlank() ? safe(user.getJiraProjectKey()).toUpperCase() : payloadProjectKey;
        if (projectKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Jira project key is not configured.");
        }

        Map<String, Object> fields = new java.util.LinkedHashMap<>();
        fields.put("project", Map.of("key", projectKey));
        fields.put("summary", summary);
        fields.put("description", body.toString());
        fields.put("issuetype", Map.of("name", issueType));
        if (!priority.isBlank()) {
            fields.put("priority", Map.of("name", priority));
        }

        Map<String, Object> payload = Map.of("fields", fields);
        return exchangeJson(user, HttpMethod.POST, "/rest/api/2/issue", payload);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getIssue(User user, String issueKey) {
        String safeKey = sanitizeIssueKey(issueKey);
        return exchangeJson(user, HttpMethod.GET, "/rest/api/2/issue/" + safeKey, null);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getTransitions(User user, String issueKey) {
        String safeKey = sanitizeIssueKey(issueKey);
        return exchangeJson(user, HttpMethod.GET, "/rest/api/2/issue/" + safeKey + "/transitions", null);
    }

    public void transitionIssue(User user, String issueKey, String transitionId) {
        String safeKey = sanitizeIssueKey(issueKey);
        String id = safe(transitionId);
        if (id.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "transitionId is required.");
        }
        Map<String, Object> payload = Map.of("transition", Map.of("id", id));
        exchangeJson(user, HttpMethod.POST, "/rest/api/2/issue/" + safeKey + "/transitions", payload);
    }

    public void addComment(User user, String issueKey, String commentBody) {
        String safeKey = sanitizeIssueKey(issueKey);
        String body = safe(commentBody);
        if (body.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment body is empty.");
        }
        Map<String, Object> payload = Map.of("body", body);
        exchangeJson(user, HttpMethod.POST, "/rest/api/2/issue/" + safeKey + "/comment", payload);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> exchangeJson(User user, HttpMethod method, String path, Map<String, Object> payload) {
        String url = buildUrl(user, path);
        HttpEntity<?> entity = new HttpEntity<>(payload, buildHeaders(user));
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                URI.create(url),
                method,
                entity,
                Map.class
            );
            Map<String, Object> body = response.getBody();
            return body == null ? Map.of() : body;
        } catch (HttpStatusCodeException ex) {
            int status = ex.getStatusCode().value();
            String remote = ex.getResponseBodyAsString();
            String message = "Jira request failed (" + status + ")";
            if (remote != null && !remote.isBlank()) {
                message += ": " + remote;
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, message);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Jira URL.");
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Jira request failed: " + ex.getMessage());
        }
    }

    private HttpHeaders buildHeaders(User user) {
        String username = safe(user.getJiraUsername());
        String password = safe(user.getJiraPassword());
        if (username.isBlank() || password.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Jira credentials are not configured.");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBasicAuth(username, password, StandardCharsets.UTF_8);
        return headers;
    }

    private String buildUrl(User user, String path) {
        String baseUrl = safe(user.getJiraBaseUrl()).replaceAll("/+$", "");
        if (baseUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Jira base URL is not configured.");
        }
        if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Jira base URL must start with http:// or https://");
        }
        String suffix = path.startsWith("/") ? path : "/" + path;
        return baseUrl + suffix;
    }

    private String sanitizeIssueKey(String issueKey) {
        String key = safe(issueKey).trim();
        if (key.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "issueKey is required.");
        }
        return key.replaceAll("[^A-Za-z0-9\\-]", "");
    }

    private String safe(Object value) {
        return value == null ? "" : value.toString().trim();
    }
}
