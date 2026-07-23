from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.dataset import PresetCatalog, Dataset, DatasetSplit, DatasetColumn, ClassDistribution
from app.schemas.dataset import PresetCatalogSchema, PresetPreviewSchema, ColumnSchema, ClassDistributionSchema
import uuid
import datetime
import os
from app.core.config import settings
from app.core.database import SessionLocal
from app.services.dataset_providers import get_provider

def get_presets(db: Session, category: Optional[str] = None) -> List[PresetCatalogSchema]:
    query = db.query(PresetCatalog)
    if category and category.upper() != "ALL":
        query = query.filter(PresetCatalog.category == category)
    presets = query.all()
    return [PresetCatalogSchema.model_validate(p) for p in presets]

def get_preset_preview(db: Session, preset_key: str) -> Optional[PresetPreviewSchema]:
    preset = db.query(PresetCatalog).filter(PresetCatalog.key == preset_key).first()
    if not preset:
        return None
    
    try:
        provider = get_provider(preset.provider)
        import tempfile
        dummy_path = os.path.join(tempfile.gettempdir(), "dummy_preview")
        metadata = provider.download_and_extract(preset_key, dummy_path)
        
        schema_fields = [ColumnSchema(**c) for c in metadata.get("columns", [])]
        class_dist = [ClassDistributionSchema(**c) for c in metadata.get("class_distributions", [])]
    except Exception as e:
        print(f"Failed to extract preview for {preset_key}: {e}")
        schema_fields = []
        class_dist = []
    
    return PresetPreviewSchema(
        preset=PresetCatalogSchema.model_validate(preset),
        schema_fields=schema_fields,
        classDistribution=class_dist
    )

def import_preset_background(preset_key: str, project_id: str):
    db = SessionLocal()
    try:
        preset = db.query(PresetCatalog).filter(PresetCatalog.key == preset_key).first()
        if not preset:
            return
            
        provider = get_provider(preset.provider)
        
        # Determine storage path
        # Use a shared directory for all preset datasets to save memory/disk space across projects
        storage_path = os.path.join(str(settings.DATABASE_PATH).replace("app.db", ""), "datasets", "shared_presets", preset_key)
        
        # Download and extract metadata
        metadata = provider.download_and_extract(preset_key, storage_path)
        
        dataset_id = str(uuid.uuid4())
        
        # Insert dataset
        new_dataset = Dataset(
            id=dataset_id,
            slug=f"{preset_key}-{dataset_id[:8]}",
            project_id=project_id,
            name=preset.name,
            category=preset.category,
            sample_count=metadata["sample_count"],
            disk_size=metadata["disk_size"],
            format=metadata["format"],
            class_count=metadata["class_count"],
            feature_count=metadata["feature_count"],
            description=preset.description,
            storage_path=storage_path,
            is_preloaded=1,
            created_at=datetime.datetime.now().isoformat(),
            updated_at=datetime.datetime.now().isoformat()
        )
        db.add(new_dataset)
        
        # Insert splits
        for split_info in metadata.get("splits", []):
            db.add(DatasetSplit(
                id=str(uuid.uuid4()),
                dataset_id=dataset_id,
                split_name=split_info["split_name"],
                sample_count=split_info["sample_count"]
            ))
            
        # Insert columns
        for col_info in metadata.get("columns", []):
            db.add(DatasetColumn(
                id=str(uuid.uuid4()),
                dataset_id=dataset_id,
                column_name=col_info["column_name"],
                dtype=col_info["dtype"],
                non_null_count=col_info["non_null_count"],
                stat_mean=col_info.get("stat_mean"),
                stat_min=col_info.get("stat_min"),
                stat_max=col_info.get("stat_max"),
                ordinal=col_info["ordinal"]
            ))
            
        # Insert class distributions
        for cls_info in metadata.get("class_distributions", []):
            db.add(ClassDistribution(
                id=str(uuid.uuid4()),
                dataset_id=dataset_id,
                class_name=cls_info["class_name"],
                sample_count=cls_info["sample_count"],
                ordinal=cls_info["ordinal"]
            ))
            
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error importing preset: {e}")
    finally:
        db.close()
