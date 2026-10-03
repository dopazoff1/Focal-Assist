package com.focal.api.models;

import jakarta.persistence.*;

@Entity
@Table(name = "kb_validation_chain_steps", uniqueConstraints = {
        @UniqueConstraint(name = "uk_kb_validation_chain_step_order", columnNames = {"step_order"}),
        @UniqueConstraint(name = "uk_kb_validation_chain_reviewer", columnNames = {"reviewer_id"})
})
public class KbValidationChainStep {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reviewer_id", nullable = false)
    private User reviewer;

    @Column(name = "step_order", nullable = false)
    private Integer stepOrder;

    public Long getId() { return id; }
    public User getReviewer() { return reviewer; }
    public void setReviewer(User reviewer) { this.reviewer = reviewer; }
    public Integer getStepOrder() { return stepOrder; }
    public void setStepOrder(Integer stepOrder) { this.stepOrder = stepOrder; }
}
