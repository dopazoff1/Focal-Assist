package com.crdpls.api.service;

import com.crdpls.api.dto.TreeChoiceSaveDto;
import com.crdpls.api.dto.TreePageSaveDto;
import com.crdpls.api.dto.TreeSaveRequestDto;
import com.crdpls.api.models.Choice;
import com.crdpls.api.models.Page;
import com.crdpls.api.repository.ChoiceRepository;
import com.crdpls.api.repository.PageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class PageService {

    private static final String TEMP_NAME_PREFIX = "__TREE_TMP_NAME_ID__:";
    private static final String TEMP_TAG_PREFIX = "__TREE_TMP_ID__:";
    private static final String TEMP_CONTENT_PREFIX = "__TREE_TMP_CONTENT_ID__:";

    @Autowired
    private PageRepository pageRepository;

    @Autowired
    private ChoiceRepository choiceRepository;

    public List<Page> getAllPagesWithChoices() {
        List<Page> pages = pageRepository.findAllByOrderByIdAsc();
        for (Page page : pages) {
            List<Choice> choices = choiceRepository.findBySourcePageIdOrderByDisplayOrderAsc(page.getId());
            page.setChoices(choices);
        }
        return pages;
    }

    public Page getPageWithChoices(Long id) {
        Page page = pageRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Page not found with id: " + id));

        List<Choice> choices = choiceRepository.findBySourcePageIdOrderByDisplayOrderAsc(id);
        page.setChoices(choices);

        return page;
    }

    @Transactional
    public Map<String, Object> saveTree(TreeSaveRequestDto request) {
        List<TreePageSaveDto> incomingPages = request != null ? request.getPages() : null;
        if (incomingPages == null || incomingPages.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No pages provided in request.");
        }

        List<Page> persistedPages = new ArrayList<>(incomingPages.size());
        Map<Long, Long> pageIdMap = new HashMap<>();
        List<TreePageSaveDto> normalizedDtos = new ArrayList<>(incomingPages.size());

        // Pass 1: create/update pages without prev linkage resolution.
        for (TreePageSaveDto dto : incomingPages) {
            if (dto == null) {
                continue;
            }
            normalizedDtos.add(dto);

            Page page = dto.getId() != null
                    ? pageRepository.findById(dto.getId()).orElse(new Page())
                    : new Page();

            page.setName(dto.getName());
            page.setContent(dto.getContent());
            page.setTag(dto.getTag());
            page.setPrevPageId(null);
            page.setIsStart(Boolean.TRUE.equals(dto.getIsStart()));

            Page saved = pageRepository.save(page);
            persistedPages.add(saved);

            if (dto.getId() != null) {
                pageIdMap.put(dto.getId(), saved.getId());
            } else {
                Long tempId = extractTempId(dto);
                if (tempId != null) {
                    pageIdMap.put(tempId, saved.getId());
                }
            }
        }

        // Pass 2: resolve prev_page_id once all ids are known.
        for (int i = 0; i < normalizedDtos.size(); i++) {
            TreePageSaveDto pageDto = normalizedDtos.get(i);
            Page savedPage = persistedPages.get(i);

            Long mappedPrev = pageDto.getPrevPageId() != null
                    ? pageIdMap.getOrDefault(pageDto.getPrevPageId(), pageDto.getPrevPageId())
                    : null;

            if (mappedPrev != null && !pageRepository.existsById(mappedPrev)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid prevPageId " + mappedPrev + " for page \"" + savedPage.getName() + "\"."
                );
            }

            savedPage.setPrevPageId(mappedPrev);
            persistedPages.set(i, pageRepository.save(savedPage));
        }

        // Pass 3: replace outgoing choices per source page.
        for (int i = 0; i < normalizedDtos.size(); i++) {
            TreePageSaveDto pageDto = normalizedDtos.get(i);
            if (pageDto == null) {
                continue;
            }

            Page savedSource = persistedPages.get(i);
            Long sourcePageId = savedSource.getId();

            choiceRepository.deleteBySourcePageId(sourcePageId);

            List<TreeChoiceSaveDto> incomingChoices = pageDto.getChoices();
            if (incomingChoices == null || incomingChoices.isEmpty()) {
                continue;
            }

            int fallbackOrder = 1;
            for (TreeChoiceSaveDto choiceDto : incomingChoices) {
                if (choiceDto == null) {
                    continue;
                }

                Long mappedTarget = choiceDto.getTargetPageId() != null
                        ? pageIdMap.getOrDefault(choiceDto.getTargetPageId(), choiceDto.getTargetPageId())
                        : null;

                if (mappedTarget == null) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Choice \"" + choiceDto.getLabel() + "\" from page \"" + savedSource.getName() + "\" has no targetPageId."
                    );
                }

                if (!pageRepository.existsById(mappedTarget)) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Choice \"" + choiceDto.getLabel() + "\" from page \"" + savedSource.getName()
                                    + "\" points to missing page id " + mappedTarget + "."
                    );
                }

                Choice choice = new Choice();

                choice.setLabel(choiceDto.getLabel());
                choice.setSourcePageId(sourcePageId);
                choice.setTargetPageId(mappedTarget);
                choice.setDisplayOrder(choiceDto.getDisplayOrder() != null ? choiceDto.getDisplayOrder() : fallbackOrder);
                fallbackOrder++;

                choiceRepository.save(choice);
            }
        }

        // Pass 4: delete pages removed from a full-tree payload.
        // Skip this on stage-1 "new pages only" save (all ids are null).
        boolean fullTreePayload = normalizedDtos.stream().anyMatch(dto -> dto.getId() != null);
        if (fullTreePayload) {
            Set<Long> keepPageIds = new HashSet<>();
            for (Page page : persistedPages) {
                keepPageIds.add(page.getId());
            }

            List<Page> allPages = pageRepository.findAll();
            List<Long> deletePageIds = new ArrayList<>();
            for (Page page : allPages) {
                if (!keepPageIds.contains(page.getId())) {
                    deletePageIds.add(page.getId());
                }
            }

            if (!deletePageIds.isEmpty()) {
                // Remove incoming references first to satisfy fk_choice_target.
                choiceRepository.deleteByTargetPageIdIn(deletePageIds);
                pageRepository.deleteAllById(deletePageIds);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("savedPages", persistedPages.size());
        response.put("idMap", pageIdMap);
        response.put("savedPageIds", persistedPages.stream().map(Page::getId).collect(java.util.stream.Collectors.toList()));
        return response;
    }

    private Long extractTempId(TreePageSaveDto dto) {
        Long byName = extractMarkerValue(dto.getName(), TEMP_NAME_PREFIX, '[', ']');
        if (byName != null) {
            return byName;
        }

        Long byTag = extractMarkerValue(dto.getTag(), TEMP_TAG_PREFIX, null, null);
        if (byTag != null) {
            return byTag;
        }

        return extractMarkerValue(dto.getContent(), TEMP_CONTENT_PREFIX, null, null);
    }

    private Long extractMarkerValue(String source, String prefix, Character leftBoundary, Character rightBoundary) {
        if (source == null || source.isBlank()) {
            return null;
        }

        int idx = source.indexOf(prefix);
        if (idx < 0) {
            return null;
        }

        int start = idx + prefix.length();
        int end = start;
        while (end < source.length() && Character.isDigit(source.charAt(end))) {
            end++;
        }

        if (start == end) {
            return null;
        }

        if (leftBoundary != null && (idx == 0 || source.charAt(idx - 1) != leftBoundary)) {
            return null;
        }

        if (rightBoundary != null && (end >= source.length() || source.charAt(end) != rightBoundary)) {
            return null;
        }

        try {
            return Long.valueOf(source.substring(start, end));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}

