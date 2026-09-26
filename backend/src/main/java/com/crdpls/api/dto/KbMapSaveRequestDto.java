package com.crdpls.api.dto;

import java.util.ArrayList;
import java.util.List;

public class KbMapSaveRequestDto {
    private Long articleId;
    private List<KbMapNodeDto> nodes = new ArrayList<>();
    private List<KbMapEdgeDto> edges = new ArrayList<>();

    public Long getArticleId() { return articleId; }
    public void setArticleId(Long articleId) { this.articleId = articleId; }

    public List<KbMapNodeDto> getNodes() { return nodes; }
    public void setNodes(List<KbMapNodeDto> nodes) { this.nodes = nodes; }

    public List<KbMapEdgeDto> getEdges() { return edges; }
    public void setEdges(List<KbMapEdgeDto> edges) { this.edges = edges; }
}
