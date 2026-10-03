package com.focal.api.dto;

public class ChatOauthStartDto {
    private String authUrl;
    private String state;

    public String getAuthUrl() { return authUrl; }
    public void setAuthUrl(String authUrl) { this.authUrl = authUrl; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
}
