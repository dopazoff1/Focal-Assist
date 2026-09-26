package com.crdpls.api.dto;

import java.util.List;

public class CaseTagMapSaveRequestDto {
    private List<CaseTagNodeDto> nodes;
    private List<CaseTagEdgeDto> edges;

    public List<CaseTagNodeDto> getNodes() {
        return nodes;
    }

    public void setNodes(List<CaseTagNodeDto> nodes) {
        this.nodes = nodes;
    }

    public List<CaseTagEdgeDto> getEdges() {
        return edges;
    }

    public void setEdges(List<CaseTagEdgeDto> edges) {
        this.edges = edges;
    }
}
