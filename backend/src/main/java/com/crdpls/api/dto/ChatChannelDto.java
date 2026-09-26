package com.crdpls.api.dto;

public class ChatChannelDto {
    private String type;
    private String label;
    private String handle;
    private boolean connected;
    private String lastSyncAt;

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getHandle() { return handle; }
    public void setHandle(String handle) { this.handle = handle; }

    public boolean isConnected() { return connected; }
    public void setConnected(boolean connected) { this.connected = connected; }

    public String getLastSyncAt() { return lastSyncAt; }
    public void setLastSyncAt(String lastSyncAt) { this.lastSyncAt = lastSyncAt; }
}
