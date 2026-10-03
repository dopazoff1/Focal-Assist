package com.focal.api.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "collab_user_preferences",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_collab_user_pref_user", columnNames = {"user_id"})
    }
)
public class CollaborationUserPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "starred_room_ids", columnDefinition = "TEXT")
    private String starredRoomIds;

    @Column(name = "muted_room_ids", columnDefinition = "TEXT")
    private String mutedRoomIds;

    @Column(name = "saved_message_ids", columnDefinition = "TEXT")
    private String savedMessageIds;

    @Column(name = "last_read_by_room", columnDefinition = "LONGTEXT")
    private String lastReadByRoom;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        if (this.updatedAt == null) {
            this.updatedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getStarredRoomIds() {
        return starredRoomIds;
    }

    public void setStarredRoomIds(String starredRoomIds) {
        this.starredRoomIds = starredRoomIds;
    }

    public String getMutedRoomIds() {
        return mutedRoomIds;
    }

    public void setMutedRoomIds(String mutedRoomIds) {
        this.mutedRoomIds = mutedRoomIds;
    }

    public String getSavedMessageIds() {
        return savedMessageIds;
    }

    public void setSavedMessageIds(String savedMessageIds) {
        this.savedMessageIds = savedMessageIds;
    }

    public String getLastReadByRoom() {
        return lastReadByRoom;
    }

    public void setLastReadByRoom(String lastReadByRoom) {
        this.lastReadByRoom = lastReadByRoom;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}

