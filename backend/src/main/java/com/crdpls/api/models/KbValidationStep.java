package com.crdpls.api.models;

import jakarta.persistence.*;

@Entity
@Table(name = "kb_validation_steps", uniqueConstraints = {
        @UniqueConstraint(name = "uk_kb_validation_step_order", columnNames = {"revision_id", "step_order"})
})
public class KbValidationStep {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "revision_id", nullable = false)
    private KbArticleRevision revision;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reviewer_id", nullable = false)
    private User reviewer;

    @Column(name = "step_order", nullable = false)
    private Integer stepOrder;

    public Long getId() { return id; }
    public KbArticleRevision getRevision() { return revision; }
    public void setRevision(KbArticleRevision revision) { this.revision = revision; }
    public User getReviewer() { return reviewer; }
    public void setReviewer(User reviewer) { this.reviewer = reviewer; }
    public Integer getStepOrder() { return stepOrder; }
    public void setStepOrder(Integer stepOrder) { this.stepOrder = stepOrder; }
}
