package com.focal.api.repository;

import com.focal.api.models.CaseTagNode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CaseTagNodeRepository extends JpaRepository<CaseTagNode, Long> {
    List<CaseTagNode> findAllByOrderByIdAsc();
}
