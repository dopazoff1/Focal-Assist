package com.crdpls.api.models;

import jakarta.persistence.*;

@Entity
@Table(
    name = "chat_workflow_connections",
    indexes = {
        @Index(name = "idx_chat_workflow_connections_workflow", columnList = "workflow_id"),
        @Index(name = "idx_chat_workflow_connections_source", columnList = "workflow_id,source_node_id")
    }
)
public class ChatWorkflowConnection {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workflow_id", nullable = false)
    private ChatWorkflow workflow;

    @Column(name = "source_node_id", nullable = false, length = 80)
    private String sourceNodeId;

    @Column(name = "target_node_id", nullable = false, length = 80)
    private String targetNodeId;

    @Column(length = 160)
    private String label;

    @Column(name = "source_handle", length = 80)
    private String sourceHandle;

    @Column(name = "target_handle", length = 80)
    private String targetHandle;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ChatWorkflow getWorkflow() { return workflow; }
    public void setWorkflow(ChatWorkflow workflow) { this.workflow = workflow; }
    public String getSourceNodeId() { return sourceNodeId; }
    public void setSourceNodeId(String sourceNodeId) { this.sourceNodeId = sourceNodeId; }
    public String getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(String targetNodeId) { this.targetNodeId = targetNodeId; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getSourceHandle() { return sourceHandle; }
    public void setSourceHandle(String sourceHandle) { this.sourceHandle = sourceHandle; }
    public String getTargetHandle() { return targetHandle; }
    public void setTargetHandle(String targetHandle) { this.targetHandle = targetHandle; }
}
