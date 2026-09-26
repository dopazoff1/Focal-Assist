package com.crdpls.api.service;

import com.crdpls.api.dto.KbMapEdgeDto;
import com.crdpls.api.dto.KbMapNodeDto;
import com.crdpls.api.dto.KbMapResponseDto;
import com.crdpls.api.dto.KbMapSaveRequestDto;
import com.crdpls.api.models.KbArticle;
import com.crdpls.api.models.KbMapEdge;
import com.crdpls.api.models.KbMapNode;
import com.crdpls.api.models.User;
import com.crdpls.api.repository.KbArticleRepository;
import com.crdpls.api.repository.KbMapEdgeRepository;
import com.crdpls.api.repository.KbMapNodeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class KbMapService {

    private final KbArticleRepository kbArticleRepository;
    private final KbMapNodeRepository kbMapNodeRepository;
    private final KbMapEdgeRepository kbMapEdgeRepository;
    private final KbValidationService validationService;

    public KbMapService(
            KbArticleRepository kbArticleRepository,
            KbMapNodeRepository kbMapNodeRepository,
            KbMapEdgeRepository kbMapEdgeRepository,
            KbValidationService validationService
    ) {
        this.kbArticleRepository = kbArticleRepository;
        this.kbMapNodeRepository = kbMapNodeRepository;
        this.kbMapEdgeRepository = kbMapEdgeRepository;
        this.validationService = validationService;
    }

    @Transactional(readOnly = true)
    public KbMapResponseDto getArticleMap(Long articleId) {
        KbArticle article = kbArticleRepository.findById(articleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "KB article not found: " + articleId));

        KbMapResponseDto response = new KbMapResponseDto();
        response.setArticleId(article.getId());

        List<KbMapNode> nodes = kbMapNodeRepository.findByArticleIdOrderByIdAsc(articleId);
        List<KbMapNodeDto> nodeDtos = new ArrayList<>(nodes.size());
        for (KbMapNode node : nodes) {
            KbMapNodeDto dto = new KbMapNodeDto();
            dto.setId(node.getId());
            dto.setArticleId(articleId);
            dto.setTitle(node.getTitle());
            dto.setLabel(node.getLabel());
            dto.setContent(node.getContent());
            dto.setXPos(node.getXPos());
            dto.setYPos(node.getYPos());
            dto.setIsStart(Boolean.TRUE.equals(node.getIsStart()));
            nodeDtos.add(dto);
        }
        response.setNodes(nodeDtos);

        List<KbMapEdge> edges = kbMapEdgeRepository.findByArticleIdOrderByDisplayOrderAscIdAsc(articleId);
        List<KbMapEdgeDto> edgeDtos = new ArrayList<>(edges.size());
        for (KbMapEdge edge : edges) {
            KbMapEdgeDto dto = new KbMapEdgeDto();
            dto.setId(edge.getId());
            dto.setSourceNodeId(edge.getSourceNodeId());
            dto.setTargetNodeId(edge.getTargetNodeId());
            dto.setLabel(edge.getLabel());
            dto.setDisplayOrder(edge.getDisplayOrder());
            edgeDtos.add(dto);
        }
        response.setEdges(edgeDtos);

        return response;
    }

    @Transactional
    public Map<String, Object> saveArticleMap(Long articleId, KbMapSaveRequestDto request, User maker) {
        validationService.saveMapDraft(maker, articleId, request);

        /*
         * The map editor still receives its historical response shape. The payload is now
         * stored on the article revision and is published with the final approval.
         */
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("articleId", articleId);
        response.put("pendingValidation", true);
        response.put("savedNodes", request == null || request.getNodes() == null ? 0 : request.getNodes().size());
        response.put("savedEdges", request == null || request.getEdges() == null ? 0 : request.getEdges().size());
        return response;
    }

}
