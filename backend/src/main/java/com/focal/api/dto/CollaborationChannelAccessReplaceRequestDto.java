package com.focal.api.dto;

import java.util.List;

public class CollaborationChannelAccessReplaceRequestDto {
    private List<Long> channelIds;

    public List<Long> getChannelIds() { return channelIds; }
    public void setChannelIds(List<Long> channelIds) { this.channelIds = channelIds; }
}
