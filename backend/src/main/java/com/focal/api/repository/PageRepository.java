package com.focal.api.repository;

import  com.focal.api.models.Page;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PageRepository extends JpaRepository<Page, Long> {
    List<Page> findAllByOrderByIdAsc();
}
