package com.focal.api.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "qa_evaluations")
public class QaEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private CemConversation conversation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluated_user_id", nullable = false)
    private User evaluatedUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluator_user_id", nullable = false)
    private User evaluatorUser;

    @Column(nullable = false)
    private Integer score;

    @Column(name = "strengths", columnDefinition = "TEXT")
    private String strengths;

    @Column(name = "improvements", columnDefinition = "TEXT")
    private String improvements;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public CemConversation getConversation() {
        return conversation;
    }

    public void setConversation(CemConversation conversation) {
        this.conversation = conversation;
    }

    public User getEvaluatedUser() {
        return evaluatedUser;
    }

    public void setEvaluatedUser(User evaluatedUser) {
        this.evaluatedUser = evaluatedUser;
    }

    public User getEvaluatorUser() {
        return evaluatorUser;
    }

    public void setEvaluatorUser(User evaluatorUser) {
        this.evaluatorUser = evaluatorUser;
    }

    public Integer getScore() {
        return score;
    }

    public void setScore(Integer score) {
        this.score = score;
    }

    public String getStrengths() {
        return strengths;
    }

    public void setStrengths(String strengths) {
        this.strengths = strengths;
    }

    public String getImprovements() {
        return improvements;
    }

    public void setImprovements(String improvements) {
        this.improvements = improvements;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}

