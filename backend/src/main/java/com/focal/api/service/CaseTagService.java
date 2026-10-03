package com.focal.api.service;

import com.focal.api.dto.CaseTagEdgeDto;
import com.focal.api.dto.CaseTagMapResponseDto;
import com.focal.api.dto.CaseTagMapSaveRequestDto;
import com.focal.api.dto.CaseTagNodeDto;
import com.focal.api.models.CaseTagEdge;
import com.focal.api.models.CaseTagNode;
import com.focal.api.repository.CaseTagEdgeRepository;
import com.focal.api.repository.CaseTagNodeRepository;
import com.focal.api.repository.CemConversationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class CaseTagService {

    private final CaseTagNodeRepository caseTagNodeRepository;
    private final CaseTagEdgeRepository caseTagEdgeRepository;
    private final CemConversationRepository conversationRepository;

    public CaseTagService(
        CaseTagNodeRepository caseTagNodeRepository,
        CaseTagEdgeRepository caseTagEdgeRepository,
        CemConversationRepository conversationRepository
    ) {
        this.caseTagNodeRepository = caseTagNodeRepository;
        this.caseTagEdgeRepository = caseTagEdgeRepository;
        this.conversationRepository = conversationRepository;
    }

    @Transactional(readOnly = true)
    public CaseTagMapResponseDto getMap() {
        List<CaseTagNode> nodes = caseTagNodeRepository.findAllByOrderByIdAsc();
        List<CaseTagEdge> edges = caseTagEdgeRepository.findAllByOrderByDisplayOrderAscIdAsc();

        List<CaseTagNodeDto> nodeDtos = new ArrayList<>(nodes.size());
        for (CaseTagNode node : nodes) {
            CaseTagNodeDto dto = new CaseTagNodeDto();
            dto.setId(node.getId());
            dto.setLabel(node.getLabel());
            dto.setContent(node.getContent());
            dto.setXPos(node.getXPos());
            dto.setYPos(node.getYPos());
            dto.setIsStart(Boolean.TRUE.equals(node.getIsStart()));
            nodeDtos.add(dto);
        }

        List<CaseTagEdgeDto> edgeDtos = new ArrayList<>(edges.size());
        for (CaseTagEdge edge : edges) {
            CaseTagEdgeDto dto = new CaseTagEdgeDto();
            dto.setId(edge.getId());
            dto.setSourceNodeId(edge.getSourceNodeId());
            dto.setTargetNodeId(edge.getTargetNodeId());
            dto.setLabel(edge.getLabel());
            dto.setDisplayOrder(edge.getDisplayOrder());
            edgeDtos.add(dto);
        }

        CaseTagMapResponseDto response = new CaseTagMapResponseDto();
        response.setNodes(nodeDtos);
        response.setEdges(edgeDtos);
        return response;
    }

    @Transactional
    public Map<String, Object> saveMap(CaseTagMapSaveRequestDto request) {
        List<CaseTagNodeDto> nodes = request != null && request.getNodes() != null ? request.getNodes() : Collections.emptyList();
        List<CaseTagEdgeDto> edges = request != null && request.getEdges() != null ? request.getEdges() : Collections.emptyList();

        conversationRepository.clearAllTagLinks();
        caseTagEdgeRepository.deleteAllInBatch();
        caseTagNodeRepository.deleteAllInBatch();

        Map<Long, Long> nodeIdMap = new HashMap<>();
        List<CaseTagNode> savedNodes = new ArrayList<>();

        long syntheticKey = -1L;
        for (CaseTagNodeDto nodeDto : nodes) {
            if (nodeDto == null) {
                continue;
            }

            CaseTagNode node = new CaseTagNode();
            node.setLabel(nodeDto.getLabel());
            node.setContent(nodeDto.getContent());
            node.setXPos(nodeDto.getXPos());
            node.setYPos(nodeDto.getYPos());
            node.setIsStart(Boolean.TRUE.equals(nodeDto.getIsStart()));

            CaseTagNode saved = caseTagNodeRepository.save(node);
            savedNodes.add(saved);

            Long clientId = nodeDto.getId();
            if (clientId != null && clientId > 0) {
                nodeIdMap.put(clientId, saved.getId());
            } else {
                nodeIdMap.put(syntheticKey--, saved.getId());
            }
        }

        int fallbackOrder = 1;
        List<CaseTagEdge> savedEdges = new ArrayList<>();
        for (CaseTagEdgeDto edgeDto : edges) {
            if (edgeDto == null) {
                continue;
            }

            Long sourceId = mapNodeId(edgeDto.getSourceNodeId(), nodeIdMap);
            Long targetId = mapNodeId(edgeDto.getTargetNodeId(), nodeIdMap);

            if (sourceId == null || targetId == null) {
                throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid edge mapping. source=" + edgeDto.getSourceNodeId() + ", target=" + edgeDto.getTargetNodeId()
                );
            }

            CaseTagEdge edge = new CaseTagEdge();
            edge.setSourceNodeId(sourceId);
            edge.setTargetNodeId(targetId);
            edge.setLabel(valueOrDefault(edgeDto.getLabel(), "Next"));
            edge.setDisplayOrder(edgeDto.getDisplayOrder() != null ? edgeDto.getDisplayOrder() : fallbackOrder);
            fallbackOrder++;

            savedEdges.add(caseTagEdgeRepository.save(edge));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("savedNodes", savedNodes.size());
        response.put("savedEdges", savedEdges.size());
        return response;
    }

    private Long mapNodeId(Long clientNodeId, Map<Long, Long> nodeIdMap) {
        if (clientNodeId == null) {
            return null;
        }
        Long mapped = nodeIdMap.get(clientNodeId);
        if (mapped != null) {
            return mapped;
        }
        if (nodeIdMap.containsValue(clientNodeId)) {
            return clientNodeId;
        }
        return null;
    }

    private String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
