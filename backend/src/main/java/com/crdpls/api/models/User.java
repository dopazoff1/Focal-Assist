package com.crdpls.api.models;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "users") // your SQL table name
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(nullable = false)
    private LocalDate dob;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String role;

    @Column(name = "active")
    private Boolean active = true;

    @Column(name = "status", nullable = false, length = 20)
    private String status = UserStatus.OFFLINE;

    @Column(name = "deactivation_reason")
    private String deactivationReason;

    @Column(name = "deactivated_at")
    private LocalDateTime deactivatedAt;

    @Column(name = "time_zone", length = 64)
    private String timeZone;

    @Column(name = "ui_language", length = 10)
    private String uiLanguage;

    @Column(name = "desktop_notifications_enabled", nullable = false)
    private Boolean desktopNotificationsEnabled = true;

    @Column(name = "sound_notifications_enabled", nullable = false)
    private Boolean soundNotificationsEnabled = true;

    @Column(name = "mfa_enabled", nullable = false)
    private Boolean mfaEnabled = false;

    @Column(name = "mfa_secret_encrypted", length = 1024)
    private String mfaSecretEncrypted;

    @Column(name = "mfa_pending_secret_encrypted", length = 1024)
    private String mfaPendingSecretEncrypted;

    @Column(name = "mfa_pending_expires_at")
    private LocalDateTime mfaPendingExpiresAt;

    @Column(name = "mfa_backup_codes", length = 4096)
    private String mfaBackupCodes;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "profile_photo_original", columnDefinition = "LONGBLOB")
    private byte[] profilePhotoOriginal;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "profile_photo_light", columnDefinition = "MEDIUMBLOB")
    private byte[] profilePhotoLight;

    @Column(name = "profile_photo_content_type", length = 64)
    private String profilePhotoContentType;

    @Column(name = "profile_photo_updated_at")
    private LocalDateTime profilePhotoUpdatedAt;

    @Column(name = "jira_base_url", length = 255)
    private String jiraBaseUrl;

    @Column(name = "jira_username", length = 255)
    private String jiraUsername;

    @Column(name = "jira_password", length = 512)
    private String jiraPassword;

    @Column(name = "jira_project_key", length = 64)
    private String jiraProjectKey;

    @Column(name = "jira_issue_type_name", length = 80)
    private String jiraIssueTypeName;

    public User() {}

    // Getters & setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public LocalDate getDob() { return dob; }
    public void setDob(LocalDate dob) { this.dob = dob; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getDeactivationReason() { return deactivationReason; }
    public void setDeactivationReason(String deactivationReason) { this.deactivationReason = deactivationReason; }

    public LocalDateTime getDeactivatedAt() { return deactivatedAt; }
    public void setDeactivatedAt(LocalDateTime deactivatedAt) { this.deactivatedAt = deactivatedAt; }

    public String getTimeZone() { return timeZone; }
    public void setTimeZone(String timeZone) { this.timeZone = timeZone; }

    public String getUiLanguage() { return uiLanguage; }
    public void setUiLanguage(String uiLanguage) { this.uiLanguage = uiLanguage; }

    public Boolean getDesktopNotificationsEnabled() { return desktopNotificationsEnabled; }
    public void setDesktopNotificationsEnabled(Boolean desktopNotificationsEnabled) { this.desktopNotificationsEnabled = desktopNotificationsEnabled; }

    public Boolean getSoundNotificationsEnabled() { return soundNotificationsEnabled; }
    public void setSoundNotificationsEnabled(Boolean soundNotificationsEnabled) { this.soundNotificationsEnabled = soundNotificationsEnabled; }

    public Boolean getMfaEnabled() { return mfaEnabled; }
    public void setMfaEnabled(Boolean mfaEnabled) { this.mfaEnabled = mfaEnabled; }

    public String getMfaSecretEncrypted() { return mfaSecretEncrypted; }
    public void setMfaSecretEncrypted(String mfaSecretEncrypted) { this.mfaSecretEncrypted = mfaSecretEncrypted; }

    public String getMfaPendingSecretEncrypted() { return mfaPendingSecretEncrypted; }
    public void setMfaPendingSecretEncrypted(String mfaPendingSecretEncrypted) { this.mfaPendingSecretEncrypted = mfaPendingSecretEncrypted; }

    public LocalDateTime getMfaPendingExpiresAt() { return mfaPendingExpiresAt; }
    public void setMfaPendingExpiresAt(LocalDateTime mfaPendingExpiresAt) { this.mfaPendingExpiresAt = mfaPendingExpiresAt; }

    public String getMfaBackupCodes() { return mfaBackupCodes; }
    public void setMfaBackupCodes(String mfaBackupCodes) { this.mfaBackupCodes = mfaBackupCodes; }

    public byte[] getProfilePhotoOriginal() { return profilePhotoOriginal; }
    public void setProfilePhotoOriginal(byte[] profilePhotoOriginal) { this.profilePhotoOriginal = profilePhotoOriginal; }

    public byte[] getProfilePhotoLight() { return profilePhotoLight; }
    public void setProfilePhotoLight(byte[] profilePhotoLight) { this.profilePhotoLight = profilePhotoLight; }

    public String getProfilePhotoContentType() { return profilePhotoContentType; }
    public void setProfilePhotoContentType(String profilePhotoContentType) { this.profilePhotoContentType = profilePhotoContentType; }

    public LocalDateTime getProfilePhotoUpdatedAt() { return profilePhotoUpdatedAt; }
    public void setProfilePhotoUpdatedAt(LocalDateTime profilePhotoUpdatedAt) { this.profilePhotoUpdatedAt = profilePhotoUpdatedAt; }

    public String getJiraBaseUrl() { return jiraBaseUrl; }
    public void setJiraBaseUrl(String jiraBaseUrl) { this.jiraBaseUrl = jiraBaseUrl; }

    public String getJiraUsername() { return jiraUsername; }
    public void setJiraUsername(String jiraUsername) { this.jiraUsername = jiraUsername; }

    public String getJiraPassword() { return jiraPassword; }
    public void setJiraPassword(String jiraPassword) { this.jiraPassword = jiraPassword; }

    public String getJiraProjectKey() { return jiraProjectKey; }
    public void setJiraProjectKey(String jiraProjectKey) { this.jiraProjectKey = jiraProjectKey; }

    public String getJiraIssueTypeName() { return jiraIssueTypeName; }
    public void setJiraIssueTypeName(String jiraIssueTypeName) { this.jiraIssueTypeName = jiraIssueTypeName; }
}
