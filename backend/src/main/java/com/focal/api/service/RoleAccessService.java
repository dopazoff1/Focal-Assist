package com.focal.api.service;

import com.focal.api.dto.RoleAccessConfigDto;
import com.focal.api.dto.RoleAccessLinkDto;
import com.focal.api.dto.RoleAccessProfileDto;
import com.focal.api.models.RoleAccessLink;
import com.focal.api.models.RoleAccessProfile;
import com.focal.api.models.User;
import com.focal.api.repository.RoleAccessLinkRepository;
import com.focal.api.repository.RoleAccessProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class RoleAccessService {

    private static final Set<String> FEATURE_KEYS = Set.of(
        "command_center",
        "calendar",
        "magic_assistance",
        "knowledge_base",
        "knowledge_analytics",
        "article_management",
        "kb_article_validation",
        "kb_validation_chain",
        "collaboration",
        "chat_projects",
        "live_chat",
        "process_assistant",
        "academy",
        "academy_home",
        "academy_catalog",
        "academy_course",
        "academy_certificate",
        "academy_studio",
        "academy_analytics",
        "flowdesk",
        "escalation_desk",
        "qa_evaluation",
        "adherence",
        "team_management",
        "channel_access_map",
        "builders",
        "prompt_map_builder",
        "staff_management",
        "role_access_map",
        "user_settings"
    );

    private static final List<String> SYSTEM_ROLES = List.of(
        "ADMIN",
        "HEAD_CS",
        "OPS",
        "TEAM_LEADER",
        "QA",
        "AGENT"
    );

    private static final Map<String, List<String>> DEFAULT_ROLE_FEATURES = Map.of(
        "ADMIN", new ArrayList<>(FEATURE_KEYS),
        "HEAD_CS", List.of(
            "command_center", "calendar", "magic_assistance", "knowledge_base", "knowledge_analytics", "article_management", "collaboration",
            "chat_projects", "live_chat", "process_assistant", "academy_home", "academy_catalog", "academy_studio", "academy_analytics",
            "flowdesk", "escalation_desk", "qa_evaluation", "adherence", "team_management",
            "builders", "prompt_map_builder", "user_settings"
        ),
        "OPS", List.of(
            "command_center", "calendar", "magic_assistance", "knowledge_base", "knowledge_analytics", "article_management", "collaboration",
            "chat_projects", "live_chat", "process_assistant", "academy_home", "academy_catalog", "academy_studio", "academy_analytics",
            "flowdesk", "escalation_desk", "qa_evaluation", "adherence", "team_management",
            "user_settings"
        ),
        "TEAM_LEADER", List.of(
            "command_center", "calendar", "magic_assistance", "knowledge_base", "knowledge_analytics", "collaboration", "process_assistant",
            "live_chat", "academy_home", "academy_catalog", "academy_studio", "academy_analytics",
            "flowdesk", "escalation_desk", "adherence", "user_settings"
        ),
        "QA", List.of(
            "command_center", "calendar", "magic_assistance", "knowledge_base", "knowledge_analytics", "collaboration", "process_assistant",
            "live_chat", "academy_home", "academy_catalog", "academy_studio", "academy_analytics",
            "flowdesk", "escalation_desk", "qa_evaluation", "adherence", "user_settings"
        ),
        "AGENT", List.of(
            "command_center", "calendar", "magic_assistance", "knowledge_base", "collaboration", "process_assistant",
            "live_chat", "academy_home", "academy_catalog",
            "flowdesk", "escalation_desk", "user_settings"
        )
    );

    private static final List<String> ACADEMY_PAGE_KEYS = List.of(
        "academy_home",
        "academy_catalog",
        "academy_studio",
        "academy_analytics"
    );

    private static final List<String> ADMIN_SAFETY_FEATURES = List.of(
        "command_center",
        "user_settings",
        "role_access_map"
    );

    private final RoleAccessProfileRepository roleAccessProfileRepository;
    private final RoleAccessLinkRepository roleAccessLinkRepository;

    public RoleAccessService(
        RoleAccessProfileRepository roleAccessProfileRepository,
        RoleAccessLinkRepository roleAccessLinkRepository
    ) {
        this.roleAccessProfileRepository = roleAccessProfileRepository;
        this.roleAccessLinkRepository = roleAccessLinkRepository;
    }

    @Transactional(readOnly = true)
    public boolean hasFeatureAccess(User user, String featureKey) {
        if (user == null || !Boolean.TRUE.equals(user.getActive()) || featureKey == null) return false;
        String roleName = normalizeRoleName(user.getRole());
        String key = normalizeFeatureKey(featureKey);
        if (roleName == null || key == null) return false;
        RoleAccessProfile profile = roleAccessProfileRepository.findByName(roleName).orElse(null);
        if (profile == null || !Boolean.TRUE.equals(profile.getActive())) return false;
        return roleAccessLinkRepository.findAllByOrderByRoleNameAscFeatureKeyAsc().stream()
                .anyMatch(link -> roleName.equals(normalizeRoleName(link.getRoleName()))
                        && key.equals(normalizeFeatureKey(link.getFeatureKey())));
    }

    @Transactional
    public RoleAccessConfigDto getConfig() {
        ensureDefaults();
        return buildResponse();
    }

    @Transactional
    public RoleAccessConfigDto saveConfig(RoleAccessConfigDto request) {
        ensureDefaults();
        List<RoleAccessProfileDto> incomingRoles = request == null || request.getRoles() == null
            ? Collections.emptyList()
            : request.getRoles();
        List<RoleAccessLinkDto> incomingLinks = request == null || request.getLinks() == null
            ? Collections.emptyList()
            : request.getLinks();

        Map<String, RoleAccessProfile> existingByName = new HashMap<>();
        for (RoleAccessProfile row : roleAccessProfileRepository.findAll()) {
            existingByName.put(normalizeRoleName(row.getName()), row);
        }

        Set<String> keepRoleNames = new HashSet<>();
        List<RoleAccessProfile> toSave = new ArrayList<>();
        for (RoleAccessProfileDto dto : incomingRoles) {
            if (dto == null) continue;
            String roleName = normalizeRoleName(dto.getName());
            if (roleName == null) continue;
            RoleAccessProfile row = existingByName.get(roleName);
            if (row == null) {
                row = new RoleAccessProfile();
                row.setName(roleName);
            }
            row.setDescription(trimToDefault(dto.getDescription(), roleName + " role"));
            row.setActive(dto.getActive() == null || dto.getActive());
            row.setSystemRole(Boolean.TRUE.equals(row.getSystemRole()) || SYSTEM_ROLES.contains(roleName));
            row.setXPos(dto.getX());
            row.setYPos(dto.getY());
            toSave.add(row);
            keepRoleNames.add(roleName);
        }

        for (String systemRole : SYSTEM_ROLES) {
            if (keepRoleNames.contains(systemRole)) continue;
            RoleAccessProfile row = existingByName.get(systemRole);
            if (row == null) {
                row = new RoleAccessProfile();
                row.setName(systemRole);
                row.setDescription(systemRole + " system role");
                row.setActive(true);
                row.setXPos(100);
                row.setYPos(80 + SYSTEM_ROLES.indexOf(systemRole) * 120);
            }
            row.setSystemRole(true);
            toSave.add(row);
            keepRoleNames.add(systemRole);
        }

        roleAccessProfileRepository.saveAll(toSave);

        List<RoleAccessProfile> allCurrent = roleAccessProfileRepository.findAll();
        for (RoleAccessProfile row : allCurrent) {
            String roleName = normalizeRoleName(row.getName());
            if (roleName == null) continue;
            if (!keepRoleNames.contains(roleName) && !Boolean.TRUE.equals(row.getSystemRole())) {
                roleAccessLinkRepository.deleteByRoleName(roleName);
                roleAccessProfileRepository.delete(row);
            }
        }

        Set<String> validRoles = new HashSet<>();
        for (RoleAccessProfile row : roleAccessProfileRepository.findAll()) {
            String roleName = normalizeRoleName(row.getName());
            if (roleName != null) validRoles.add(roleName);
        }

        Set<String> dedupe = new HashSet<>();
        List<RoleAccessLink> linksToSave = new ArrayList<>();
        for (RoleAccessLinkDto dto : incomingLinks) {
            if (dto == null) continue;
            String roleName = normalizeRoleName(dto.getRoleName());
            String featureKey = normalizeFeatureKey(dto.getFeatureKey());
            if (roleName == null || featureKey == null) continue;
            if (!validRoles.contains(roleName)) continue;
            String compound = roleName + ":" + featureKey;
            if (!dedupe.add(compound)) continue;
            RoleAccessLink row = new RoleAccessLink();
            row.setRoleName(roleName);
            row.setFeatureKey(featureKey);
            linksToSave.add(row);
        }
        ensureAdminSafetyLinks(linksToSave, dedupe, validRoles);

        roleAccessLinkRepository.deleteAllInBatch();
        if (!linksToSave.isEmpty()) {
            roleAccessLinkRepository.saveAll(linksToSave);
        }

        return buildResponse();
    }

    @Transactional
    public RoleAccessProfileDto createRole(String rawName, String rawDescription) {
        ensureDefaults();
        String roleName = normalizeRoleName(rawName);
        if (roleName == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role name is required.");
        }
        if (roleAccessProfileRepository.findByName(roleName).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Role already exists.");
        }
        RoleAccessProfile row = new RoleAccessProfile();
        row.setName(roleName);
        row.setDescription(trimToDefault(rawDescription, roleName + " role"));
        row.setSystemRole(false);
        row.setActive(true);
        int nextIndex = roleAccessProfileRepository.findAll().size();
        row.setXPos(120);
        row.setYPos(100 + nextIndex * 110);
        RoleAccessProfile saved = roleAccessProfileRepository.save(row);
        return toProfileDto(saved);
    }

    @Transactional
    public void deleteRole(String rawRoleName) {
        ensureDefaults();
        String roleName = normalizeRoleName(rawRoleName);
        if (roleName == null) return;
        RoleAccessProfile role = roleAccessProfileRepository.findByName(roleName).orElse(null);
        if (role == null) return;
        if (Boolean.TRUE.equals(role.getSystemRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "System roles cannot be deleted.");
        }
        roleAccessLinkRepository.deleteByRoleName(roleName);
        roleAccessProfileRepository.delete(role);
    }

    private RoleAccessConfigDto buildResponse() {
        RoleAccessConfigDto dto = new RoleAccessConfigDto();
        dto.setRoles(
            roleAccessProfileRepository.findAllByOrderBySystemRoleDescNameAsc()
                .stream()
                .map(this::toProfileDto)
                .toList()
        );
        dto.setLinks(
            roleAccessLinkRepository.findAllByOrderByRoleNameAscFeatureKeyAsc()
                .stream()
                .map(this::toLinkDto)
                .toList()
        );
        return dto;
    }

    private RoleAccessProfileDto toProfileDto(RoleAccessProfile row) {
        RoleAccessProfileDto dto = new RoleAccessProfileDto();
        dto.setId(row.getId());
        dto.setName(normalizeRoleName(row.getName()));
        dto.setDescription(row.getDescription() == null ? "" : row.getDescription());
        dto.setSystem(Boolean.TRUE.equals(row.getSystemRole()));
        dto.setActive(row.getActive() == null || row.getActive());
        dto.setX(row.getXPos());
        dto.setY(row.getYPos());
        return dto;
    }

    private RoleAccessLinkDto toLinkDto(RoleAccessLink row) {
        RoleAccessLinkDto dto = new RoleAccessLinkDto();
        dto.setRoleName(normalizeRoleName(row.getRoleName()));
        dto.setFeatureKey(normalizeFeatureKey(row.getFeatureKey()));
        return dto;
    }

    private void ensureDefaults() {
        if (roleAccessProfileRepository.count() == 0) {
            List<RoleAccessProfile> roles = new ArrayList<>();
            for (int i = 0; i < SYSTEM_ROLES.size(); i++) {
                String roleName = SYSTEM_ROLES.get(i);
                RoleAccessProfile row = new RoleAccessProfile();
                row.setName(roleName);
                row.setDescription(roleName + " system role");
                row.setSystemRole(true);
                row.setActive(true);
                row.setXPos(100);
                row.setYPos(80 + i * 120);
                roles.add(row);
            }
            roleAccessProfileRepository.saveAll(roles);
        } else {
            for (String roleName : SYSTEM_ROLES) {
                RoleAccessProfile row = roleAccessProfileRepository.findByName(roleName).orElse(null);
                if (row == null) {
                    row = new RoleAccessProfile();
                    row.setName(roleName);
                    row.setDescription(roleName + " system role");
                    row.setSystemRole(true);
                    row.setActive(true);
                    row.setXPos(100);
                    row.setYPos(80 + SYSTEM_ROLES.indexOf(roleName) * 120);
                } else {
                    row.setSystemRole(true);
                }
                roleAccessProfileRepository.save(row);
            }
        }

        if (roleAccessLinkRepository.count() == 0) {
            List<RoleAccessLink> links = new ArrayList<>();
            Set<String> dedupe = new HashSet<>();
            for (Map.Entry<String, List<String>> entry : DEFAULT_ROLE_FEATURES.entrySet()) {
                String roleName = entry.getKey();
                for (String featureKey : entry.getValue()) {
                    String key = roleName + ":" + featureKey;
                    if (!dedupe.add(key)) continue;
                    RoleAccessLink row = new RoleAccessLink();
                    row.setRoleName(roleName);
                    row.setFeatureKey(featureKey);
                    links.add(row);
                }
            }
            roleAccessLinkRepository.saveAll(links);
        }

        ensureAcademyGranularLinks();
        ensureValidationChainLink();
    }

    private void ensureAcademyGranularLinks() {
        List<RoleAccessLink> all = roleAccessLinkRepository.findAll();
        if (all.isEmpty()) return;

        Set<String> existing = new HashSet<>();
        Set<String> rolesWithLegacyAcademy = new HashSet<>();
        for (RoleAccessLink row : all) {
            String roleName = normalizeRoleName(row.getRoleName());
            String featureKey = normalizeFeatureKey(row.getFeatureKey());
            if (roleName == null || featureKey == null) continue;
            existing.add(roleName + ":" + featureKey);
            if ("academy".equals(featureKey)) {
                rolesWithLegacyAcademy.add(roleName);
            }
        }

        if (rolesWithLegacyAcademy.isEmpty()) return;

        List<RoleAccessLink> toInsert = new ArrayList<>();
        for (String roleName : rolesWithLegacyAcademy) {
            for (String featureKey : ACADEMY_PAGE_KEYS) {
                String compound = roleName + ":" + featureKey;
                if (existing.contains(compound)) continue;
                RoleAccessLink row = new RoleAccessLink();
                row.setRoleName(roleName);
                row.setFeatureKey(featureKey);
                toInsert.add(row);
                existing.add(compound);
            }
        }
        if (!toInsert.isEmpty()) {
            roleAccessLinkRepository.saveAll(toInsert);
        }
    }

    private void ensureValidationChainLink() {
        boolean alreadyConfigured = roleAccessLinkRepository.findAll().stream()
                .anyMatch(link -> "kb_validation_chain".equals(normalizeFeatureKey(link.getFeatureKey())));
        if (alreadyConfigured) return;
        RoleAccessLink adminLink = new RoleAccessLink();
        adminLink.setRoleName("ADMIN");
        adminLink.setFeatureKey("kb_validation_chain");
        roleAccessLinkRepository.save(adminLink);
    }

    private String normalizeRoleName(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String role = raw.trim().toUpperCase(Locale.ROOT).replaceFirst("^ROLE_", "");
        if ("HEAD_OF_CS".equals(role)) return "HEAD_CS";
        if ("TL".equals(role)) return "TEAM_LEADER";
        if ("QUALITY".equals(role)) return "QA";
        if ("1".equals(role)) return "ADMIN";
        if ("2".equals(role)) return "AGENT";
        if ("3".equals(role)) return "TEAM_LEADER";
        if ("4".equals(role)) return "QA";
        if ("5".equals(role)) return "HEAD_CS";
        if ("6".equals(role)) return "OPS";
        return role;
    }

    private String normalizeFeatureKey(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String key = raw.trim().toLowerCase(Locale.ROOT);
        return FEATURE_KEYS.contains(key) ? key : null;
    }

    private String trimToDefault(String value, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String out = value.trim();
        return out.isBlank() ? fallback : out;
    }

    private void ensureAdminSafetyLinks(List<RoleAccessLink> linksToSave, Set<String> dedupe, Set<String> validRoles) {
        if (!validRoles.contains("ADMIN")) return;
        for (String featureKey : ADMIN_SAFETY_FEATURES) {
            String compound = "ADMIN:" + featureKey;
            if (!dedupe.add(compound)) continue;
            RoleAccessLink row = new RoleAccessLink();
            row.setRoleName("ADMIN");
            row.setFeatureKey(featureKey);
            linksToSave.add(row);
        }
    }
}
