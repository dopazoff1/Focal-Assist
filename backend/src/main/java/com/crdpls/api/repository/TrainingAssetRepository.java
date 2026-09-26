package com.crdpls.api.repository;

import com.crdpls.api.models.TrainingAsset;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrainingAssetRepository extends JpaRepository<TrainingAsset, String> {
}
