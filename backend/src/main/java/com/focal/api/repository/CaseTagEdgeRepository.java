package com.focal.api.repository;

import com.focal.api.models.CaseTagEdge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CaseTagEdgeRepository extends JpaRepository<CaseTagEdge, Long> {
    List<CaseTagEdge> findAllByOrderByDisplayOrderAscIdAsc();
}
