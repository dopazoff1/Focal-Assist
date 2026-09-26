package com.crdpls.api.models;

import jakarta.persistence.*;

@Entity
@Table(
    name = "pa_prompt_role_links",
    indexes = {
        @Index(name = "idx_pa_prompt_role_links_role", columnList = "role"),
        @Index(name = "idx_pa_prompt_role_links_profile", columnList = "prompt_profile_id")
    }
)
public class ProcessAssistantPromptRoleLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String role;

    @Column(name = "prompt_profile_id", nullable = false)
    private Long promptProfileId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Long getPromptProfileId() {
        return promptProfileId;
    }

    public void setPromptProfileId(Long promptProfileId) {
        this.promptProfileId = promptProfileId;
    }
}

