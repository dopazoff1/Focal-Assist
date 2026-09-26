package com.crdpls.api.dto;

import java.util.List;

public record KbHubIndexDto(
        List<KbHubCategoryDto> categories,
        List<KbHubArticleSummaryDto> articles
) {}
