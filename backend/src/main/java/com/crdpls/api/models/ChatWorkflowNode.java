package com.crdpls.api.models;

import jakarta.persistence.*;

@Entity
@Table(
    name = "chat_workflow_nodes",
    indexes = {
        @Index(name = "idx_chat_workflow_nodes_workflow", columnList = "workflow_id"),
        @Index(name = "idx_chat_workflow_nodes_client", columnList = "workflow_id,client_node_id")
    }
)
public class ChatWorkflowNode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workflow_id", nullable = false)
    private ChatWorkflow workflow;

    @Column(name = "client_node_id", nullable = false, length = 80)
    private String clientNodeId;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(name = "x_pos", nullable = false)
    private Double x = 0d;

    @Column(name = "y_pos", nullable = false)
    private Double y = 0d;

    @Column(name = "properties_json", columnDefinition = "TEXT")
    private String propertiesJson;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ChatWorkflow getWorkflow() { return workflow; }
    public void setWorkflow(ChatWorkflow workflow) { this.workflow = workflow; }
    public String getClientNodeId() { return clientNodeId; }
    public void setClientNodeId(String clientNodeId) { this.clientNodeId = clientNodeId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Double getX() { return x; }
    public void setX(Double x) { this.x = x; }
    public Double getY() { return y; }
    public void setY(Double y) { this.y = y; }
    public String getPropertiesJson() { return propertiesJson; }
    public void setPropertiesJson(String propertiesJson) { this.propertiesJson = propertiesJson; }
}
