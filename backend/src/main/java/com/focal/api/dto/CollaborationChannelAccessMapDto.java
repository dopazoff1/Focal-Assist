package com.focal.api.dto;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class CollaborationChannelAccessMapDto {
    private List<CollaborationUserDto> users = new ArrayList<>();
    private List<CollaborationRoomDto> channels = new ArrayList<>();
    private Map<String, List<Long>> channelIdsByUserId = new LinkedHashMap<>();

    public List<CollaborationUserDto> getUsers() { return users; }
    public void setUsers(List<CollaborationUserDto> users) { this.users = users; }

    public List<CollaborationRoomDto> getChannels() { return channels; }
    public void setChannels(List<CollaborationRoomDto> channels) { this.channels = channels; }

    public Map<String, List<Long>> getChannelIdsByUserId() { return channelIdsByUserId; }
    public void setChannelIdsByUserId(Map<String, List<Long>> channelIdsByUserId) { this.channelIdsByUserId = channelIdsByUserId; }
}
