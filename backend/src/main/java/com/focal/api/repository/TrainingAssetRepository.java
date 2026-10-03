package com.focal.api.repository;

import com.focal.api.models.TrainingAsset;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrainingAssetRepository extends JpaRepository<TrainingAsset, String> {
}
