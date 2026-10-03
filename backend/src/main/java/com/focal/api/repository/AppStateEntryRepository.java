package com.focal.api.repository;

import com.focal.api.models.AppStateEntry;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppStateEntryRepository extends JpaRepository<AppStateEntry, String> {
}
