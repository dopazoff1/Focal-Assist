package com.focal.api.dto;

import java.util.ArrayList;
import java.util.List;

public class CollaborationRoomDto {
    private String id;
    private String kind;
    private String name;
    private String description;
    private String topic;
    private Boolean isPrivate;
    private List<Long> memberIds = new ArrayList<>();
    private Long ownerId;
    private String createdAt;
    private List<Long> linkedArticleIds = new ArrayList<>();
    private Boolean archived;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }

    public Boolean getIsPrivate() { return isPrivate; }
    public void setIsPrivate(Boolean isPrivate) { this.isPrivate = isPrivate; }

    public List<Long> getMemberIds() { return memberIds; }
    public void setMemberIds(List<Long> memberIds) { this.memberIds = memberIds; }

    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public List<Long> getLinkedArticleIds() { return linkedArticleIds; }
    public void setLinkedArticleIds(List<Long> linkedArticleIds) { this.linkedArticleIds = linkedArticleIds; }

    public Boolean getArchived() { return archived; }
    public void setArchived(Boolean archived) { this.archived = archived; }
}

