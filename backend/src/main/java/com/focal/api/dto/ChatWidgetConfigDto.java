package com.focal.api.dto;

public class ChatWidgetConfigDto {
    private String websiteName;
    private boolean enabled;
    private String widgetToken;
    private String inboundUrl;
    private String scriptSnippet;

    public String getWebsiteName() { return websiteName; }
    public void setWebsiteName(String websiteName) { this.websiteName = websiteName; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getWidgetToken() { return widgetToken; }
    public void setWidgetToken(String widgetToken) { this.widgetToken = widgetToken; }

    public String getInboundUrl() { return inboundUrl; }
    public void setInboundUrl(String inboundUrl) { this.inboundUrl = inboundUrl; }

    public String getScriptSnippet() { return scriptSnippet; }
    public void setScriptSnippet(String scriptSnippet) { this.scriptSnippet = scriptSnippet; }
}
