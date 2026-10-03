package com.focal.api.dto;

public class ChatMessageDto {
    private Long id;
    private String sender;
    private String senderName;
    private String text;
    private String at;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public String getAt() { return at; }
    public void setAt(String at) { this.at = at; }
}
