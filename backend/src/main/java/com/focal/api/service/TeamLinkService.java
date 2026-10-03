package com.focal.api.service;

import com.focal.api.dto.TeamLinkDto;
import com.focal.api.models.TeamLink;
import com.focal.api.repository.TeamLinkRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class TeamLinkService {

    private final TeamLinkRepository teamLinkRepository;

    public TeamLinkService(TeamLinkRepository teamLinkRepository) {
        this.teamLinkRepository = teamLinkRepository;
    }

    @Transactional(readOnly = true)
    public List<TeamLinkDto> getAll() {
        List<TeamLink> links = teamLinkRepository.findAllByOrderByManagerRoleAscManagerIdAscAgentIdAsc();
        List<TeamLinkDto> out = new ArrayList<>();
        for (TeamLink link : links) {
            out.add(toDto(link));
        }
        return out;
    }

    @Transactional
    public List<TeamLinkDto> replaceForManager(String managerRole, Long managerId, List<Long> agentIds) {
        String role = normalizeManagerRole(managerRole);
        Long normalizedManagerId = normalizePositiveId(managerId, "managerId");
        Set<Long> nextAgentIds = sanitizeIds(agentIds);

        teamLinkRepository.deleteByManagerRoleAndManagerId(role, normalizedManagerId);

        for (Long agentId : nextAgentIds) {
            TeamLink link = new TeamLink();
            link.setManagerRole(role);
            link.setManagerId(normalizedManagerId);
            link.setAgentId(agentId);
            teamLinkRepository.save(link);
        }

        return getAll();
    }

    @Transactional
    public List<TeamLinkDto> replaceForAgent(Long agentId, Long teamLeaderId, Long qaId) {
        Long normalizedAgentId = normalizePositiveId(agentId, "agentId");

        List<TeamLink> existing = teamLinkRepository.findByAgentId(normalizedAgentId);
        if (!existing.isEmpty()) {
            teamLinkRepository.deleteAllInBatch(existing);
        }

        Long tl = normalizeOptionalPositiveId(teamLeaderId);
        if (tl != null) {
            TeamLink link = new TeamLink();
            link.setManagerRole("TEAM_LEADER");
            link.setManagerId(tl);
            link.setAgentId(normalizedAgentId);
            teamLinkRepository.save(link);
        }

        Long qa = normalizeOptionalPositiveId(qaId);
        if (qa != null) {
            TeamLink link = new TeamLink();
            link.setManagerRole("QA");
            link.setManagerId(qa);
            link.setAgentId(normalizedAgentId);
            teamLinkRepository.save(link);
        }

        return getAll();
    }

    private TeamLinkDto toDto(TeamLink link) {
        TeamLinkDto dto = new TeamLinkDto();
        dto.setManagerRole(link.getManagerRole());
        dto.setManagerId(link.getManagerId());
        dto.setAgentId(link.getAgentId());
        return dto;
    }

    private String normalizeManagerRole(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase();
        if ("TEAM_LEADER".equals(value)) return value;
        if ("QA".equals(value)) return value;
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "managerRole must be TEAM_LEADER or QA");
    }

    private Long normalizePositiveId(Long raw, String field) {
        if (raw == null || raw <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be a positive number");
        }
        return raw;
    }

    private Long normalizeOptionalPositiveId(Long raw) {
        if (raw == null || raw <= 0) return null;
        return raw;
    }

    private Set<Long> sanitizeIds(List<Long> ids) {
        Set<Long> out = new LinkedHashSet<>();
        if (ids == null) return out;
        for (Long value : ids) {
            if (value != null && value > 0) {
                out.add(value);
            }
        }
        return out;
    }
}
