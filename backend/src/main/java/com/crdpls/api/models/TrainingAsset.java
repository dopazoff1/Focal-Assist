package com.crdpls.api.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "training_assets")
public class TrainingAsset {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "kind", nullable = false, length = 16)
    private String kind;

    @Column(name = "filename", nullable = false, length = 512)
    private String filename;

    @Column(name = "mime_type", nullable = false, length = 255)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "data_blob", nullable = false, columnDefinition = "LONGBLOB")
    private byte[] dataBlob;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_user_id")
    private User uploadedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public byte[] getDataBlob() {
        return dataBlob;
    }

    public void setDataBlob(byte[] dataBlob) {
        this.dataBlob = dataBlob;
    }

    public User getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(User uploadedBy) {
        this.uploadedBy = uploadedBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
