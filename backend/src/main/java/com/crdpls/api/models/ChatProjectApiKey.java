package com.crdpls.api.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "chat_project_api_keys",
    indexes = {
        @Index(name = "idx_chat_project_api_key_project", columnList = "project_id"),
        @Index(name = "idx_chat_project_api_key_hash", columnList = "token_hash", unique = true)
    }
)
public class ChatProjectApiKey {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private ChatProject project;

    @Column(name = "token_hash", nullable = false, unique = true, length = 128)
    private String tokenHash;

    @Column(name = "token_preview", nullable = false, length = 40)
    private String tokenPreview;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ChatProject getProject() { return project; }
    public void setProject(ChatProject project) { this.project = project; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
    public String getTokenPreview() { return tokenPreview; }
    public void setTokenPreview(String tokenPreview) { this.tokenPreview = tokenPreview; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(LocalDateTime lastUsedAt) { this.lastUsedAt = lastUsedAt; }
}
