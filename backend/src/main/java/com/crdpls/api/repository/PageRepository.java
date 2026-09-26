package com.crdpls.api.repository;

import  com.crdpls.api.models.Page;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PageRepository extends JpaRepository<Page, Long> {
    List<Page> findAllByOrderByIdAsc();
}
