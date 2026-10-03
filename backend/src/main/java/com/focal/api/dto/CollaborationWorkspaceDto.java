package com.focal.api.dto;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class CollaborationWorkspaceDto {
    private List<CollaborationUserDto> users = new ArrayList<>();
    private List<CollaborationRoomDto> channels = new ArrayList<>();
    private List<CollaborationRoomDto> directs = new ArrayList<>();
    private List<CollaborationRoomDto> rooms = new ArrayList<>();
    private CollaborationPreferencesDto preferences = new CollaborationPreferencesDto();
    private Map<String, Integer> unreadByRoom = new HashMap<>();
    private List<CollaborationMessageDto> mentionInbox = new ArrayList<>();
    private List<CollaborationMessageDto> savedMessages = new ArrayList<>();

    public List<CollaborationUserDto> getUsers() { return users; }
    public void setUsers(List<CollaborationUserDto> users) { this.users = users; }

    public List<CollaborationRoomDto> getChannels() { return channels; }
    public void setChannels(List<CollaborationRoomDto> channels) { this.channels = channels; }

    public List<CollaborationRoomDto> getDirects() { return directs; }
    public void setDirects(List<CollaborationRoomDto> directs) { this.directs = directs; }

    public List<CollaborationRoomDto> getRooms() { return rooms; }
    public void setRooms(List<CollaborationRoomDto> rooms) { this.rooms = rooms; }

    public CollaborationPreferencesDto getPreferences() { return preferences; }
    public void setPreferences(CollaborationPreferencesDto preferences) { this.preferences = preferences; }

    public Map<String, Integer> getUnreadByRoom() { return unreadByRoom; }
    public void setUnreadByRoom(Map<String, Integer> unreadByRoom) { this.unreadByRoom = unreadByRoom; }

    public List<CollaborationMessageDto> getMentionInbox() { return mentionInbox; }
    public void setMentionInbox(List<CollaborationMessageDto> mentionInbox) { this.mentionInbox = mentionInbox; }

    public List<CollaborationMessageDto> getSavedMessages() { return savedMessages; }
    public void setSavedMessages(List<CollaborationMessageDto> savedMessages) { this.savedMessages = savedMessages; }
}

