package com.crdpls.api.repository;

import com.crdpls.api.models.CaseTagEdge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CaseTagEdgeRepository extends JpaRepository<CaseTagEdge, Long> {
    List<CaseTagEdge> findAllByOrderByDisplayOrderAscIdAsc();
}
