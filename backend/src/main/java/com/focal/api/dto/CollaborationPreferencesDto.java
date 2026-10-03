package com.focal.api.dto;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class CollaborationPreferencesDto {
    private List<String> starredRoomIds = new ArrayList<>();
    private List<String> mutedRoomIds = new ArrayList<>();
    private List<String> savedMessageIds = new ArrayList<>();
    private Map<String, String> lastReadAtByRoom = new HashMap<>();

    public List<String> getStarredRoomIds() { return starredRoomIds; }
    public void setStarredRoomIds(List<String> starredRoomIds) { this.starredRoomIds = starredRoomIds; }

    public List<String> getMutedRoomIds() { return mutedRoomIds; }
    public void setMutedRoomIds(List<String> mutedRoomIds) { this.mutedRoomIds = mutedRoomIds; }

    public List<String> getSavedMessageIds() { return savedMessageIds; }
    public void setSavedMessageIds(List<String> savedMessageIds) { this.savedMessageIds = savedMessageIds; }

    public Map<String, String> getLastReadAtByRoom() { return lastReadAtByRoom; }
    public void setLastReadAtByRoom(Map<String, String> lastReadAtByRoom) { this.lastReadAtByRoom = lastReadAtByRoom; }
}

