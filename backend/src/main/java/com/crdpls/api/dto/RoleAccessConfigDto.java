package com.crdpls.api.dto;

import java.util.ArrayList;
import java.util.List;

public class RoleAccessConfigDto {
    private List<RoleAccessProfileDto> roles = new ArrayList<>();
    private List<RoleAccessLinkDto> links = new ArrayList<>();

    public List<RoleAccessProfileDto> getRoles() {
        return roles;
    }

    public void setRoles(List<RoleAccessProfileDto> roles) {
        this.roles = roles;
    }

    public List<RoleAccessLinkDto> getLinks() {
        return links;
    }

    public void setLinks(List<RoleAccessLinkDto> links) {
        this.links = links;
    }
}

