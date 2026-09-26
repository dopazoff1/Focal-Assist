package com.crdpls.api.repository;

import com.crdpls.api.models.AppStateEntry;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppStateEntryRepository extends JpaRepository<AppStateEntry, String> {
}
