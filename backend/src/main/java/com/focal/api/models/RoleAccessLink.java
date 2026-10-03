package com.focal.api.models;

import jakarta.persistence.*;

@Entity
@Table(
    name = "role_access_links",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_role_access_links_role_feature", columnNames = {"role_name", "feature_key"})
    },
    indexes = {
        @Index(name = "idx_role_access_links_role", columnList = "role_name"),
        @Index(name = "idx_role_access_links_feature", columnList = "feature_key")
    }
)
public class RoleAccessLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "role_name", nullable = false, length = 64)
    private String roleName;

    @Column(name = "feature_key", nullable = false, length = 64)
    private String featureKey;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRoleName() {
        return roleName;
    }

    public void setRoleName(String roleName) {
        this.roleName = roleName;
    }

    public String getFeatureKey() {
        return featureKey;
    }

    public void setFeatureKey(String featureKey) {
        this.featureKey = featureKey;
    }
}

