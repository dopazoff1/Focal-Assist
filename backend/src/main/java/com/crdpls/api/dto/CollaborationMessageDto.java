package com.crdpls.api.dto;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class CollaborationMessageDto {
    private String id;
    private String roomId;
    private Long senderId;
    private String kind;
    private String content;
    private String createdAt;
    private String editedAt;
    private String parentId;
    private List<Long> mentionUserIds = new ArrayList<>();
    private List<Long> linkedArticleIds = new ArrayList<>();
    private Map<String, List<Long>> reactions = new HashMap<>();
    private Boolean pinned;
    private String deliveryState;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getEditedAt() { return editedAt; }
    public void setEditedAt(String editedAt) { this.editedAt = editedAt; }

    public String getParentId() { return parentId; }
    public void setParentId(String parentId) { this.parentId = parentId; }

    public List<Long> getMentionUserIds() { return mentionUserIds; }
    public void setMentionUserIds(List<Long> mentionUserIds) { this.mentionUserIds = mentionUserIds; }

    public List<Long> getLinkedArticleIds() { return linkedArticleIds; }
    public void setLinkedArticleIds(List<Long> linkedArticleIds) { this.linkedArticleIds = linkedArticleIds; }

    public Map<String, List<Long>> getReactions() { return reactions; }
    public void setReactions(Map<String, List<Long>> reactions) { this.reactions = reactions; }

    public Boolean getPinned() { return pinned; }
    public void setPinned(Boolean pinned) { this.pinned = pinned; }

    public String getDeliveryState() { return deliveryState; }
    public void setDeliveryState(String deliveryState) { this.deliveryState = deliveryState; }
}
