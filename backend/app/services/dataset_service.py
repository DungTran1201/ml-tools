from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

from app.models.dataset import Dataset, DatasetUpload, DatasetSplit, DatasetColumn, ClassDistribution
import os
from app.core.database import SessionLocal
from app.schemas.dataset import PreloadedDataset

def get_all_datasets(db: Session, project_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve all non-deleted datasets for a given project.
    Returns them as a list of dictionaries that match the PreloadedDataset schema structure.
    """
    datasets = db.query(Dataset).filter(
        Dataset.project_id == project_id,
        Dataset.is_deleted == 0
    ).all()
    
    result = []
    for d in datasets:
        d_dict = PreloadedDataset.process_orm_fields(d)
        result.append(d_dict)
    
    return result

def get_dataset_by_id(db: Session, dataset_id: str, project_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a specific dataset by ID and format it according to PreloadedDataset.
    Includes mock sampleRows since physical files are not implemented yet.
    """
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.project_id == project_id,
        Dataset.is_deleted == 0
    ).first()
    
    if not dataset:
        return None
        
    dataset_dict = PreloadedDataset.process_orm_fields(dataset)
    
    # Mock sample rows for demonstration purposes
    dataset_dict["sampleRows"] = [
        {"mock_id": 1, "data": f"Mock row 1 for {dataset.name}"},
        {"mock_id": 2, "data": f"Mock row 2 for {dataset.name}"},
        {"mock_id": 3, "data": f"Mock row 3 for {dataset.name}"},
        {"mock_id": 4, "data": f"Mock row 4 for {dataset.name}"},
        {"mock_id": 5, "data": f"Mock row 5 for {dataset.name}"},
    ]
    
    return dataset_dict

def initialize_upload(db: Session, filename: str, size: int, file_hash: str, project_id: str, user_id: str) -> DatasetUpload:
    new_upload = DatasetUpload(
        id=str(uuid.uuid4()),
        file_name=filename,
        file_size_bytes=size,
        upload_progress_pct=10.0,
        status="processing",
        user_id=user_id,
        project_id=project_id,
        storage_key=file_hash,
        created_at=datetime.utcnow().isoformat()
    )
    db.add(new_upload)
    db.commit()
    db.refresh(new_upload)
    return new_upload

def get_upload_status(db: Session, upload_id: str) -> Optional[DatasetUpload]:
    return db.query(DatasetUpload).filter(DatasetUpload.id == upload_id).first()

def process_upload_background(file_hash: str, file_path: str, project_id: str, original_filename: str, upload_id: str):
    db = SessionLocal()
    try:
        import pandas as pd
        upload = db.query(DatasetUpload).filter(DatasetUpload.id == upload_id).first()
        if not upload:
            return
            
        df = pd.read_csv(file_path)
        sample_count = len(df)
        dataset_id = str(uuid.uuid4())
        
        target_cols = [c for c in df.columns if c.lower() in ["target", "label", "class"]]
        target_col = target_cols[0] if target_cols else None
        class_count = df[target_col].nunique() if target_col else 0
        
        new_dataset = Dataset(
            id=dataset_id,
            slug=f"upload-{file_hash[:8]}-{dataset_id[:8]}",
            project_id=project_id,
            name=original_filename.replace(".csv", ""),
            category="Tabular",
            sample_count=sample_count,
            disk_size=f"{os.path.getsize(file_path) / (1024*1024):.2f} MB" if os.path.getsize(file_path) > 1024*1024 else f"{os.path.getsize(file_path)/1024:.2f} KB",
            format="CSV",
            class_count=class_count,
            feature_count=len(df.columns) - (1 if target_col else 0),
            description="User uploaded dataset.",
            storage_path=file_path,
            is_preloaded=0,
            uploaded_by=upload.user_id,
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat()
        )
        db.add(new_dataset)
        
        db.add(DatasetSplit(id=str(uuid.uuid4()), dataset_id=dataset_id, split_name="full", sample_count=sample_count))
        
        for i, col in enumerate(df.columns):
            db.add(DatasetColumn(
                id=str(uuid.uuid4()),
                dataset_id=dataset_id,
                column_name=col,
                dtype=str(df[col].dtype),
                non_null_count=int(df[col].count()),
                stat_mean=str(df[col].mean()) if pd.api.types.is_numeric_dtype(df[col]) else None,
                stat_min=str(df[col].min()) if pd.api.types.is_numeric_dtype(df[col]) else None,
                stat_max=str(df[col].max()) if pd.api.types.is_numeric_dtype(df[col]) else None,
                ordinal=i
            ))
            
        if target_col:
            class_counts = df[target_col].value_counts().to_dict()
            for i, (cls_name, count) in enumerate(class_counts.items()):
                db.add(ClassDistribution(
                    id=str(uuid.uuid4()),
                    dataset_id=dataset_id,
                    class_name=str(cls_name),
                    sample_count=int(count),
                    ordinal=i
                ))
                
        upload.status = "valid"
        upload.upload_progress_pct = 100.0
        upload.dataset_id = dataset_id
        db.commit()
    except Exception as e:
        db.rollback()
        upload = db.query(DatasetUpload).filter(DatasetUpload.id == upload_id).first()
        if upload:
            upload.status = "error"
            upload.error_detail = str(e)
            db.commit()
        print(f"Error processing upload: {e}")
    finally:
        db.close()

def remove_upload(db: Session, upload_id: str, project_id: str, user_id: str) -> bool:
    """
    Remove an upload entry from the DB if it belongs to the user/project.
    Returns True if deleted, False if not found.
    """
    upload = db.query(DatasetUpload).filter(
        DatasetUpload.id == upload_id,
        DatasetUpload.project_id == project_id,
        DatasetUpload.user_id == user_id
    ).first()
    
    if not upload:
        return False
        
    db.delete(upload)
    db.commit()
    return True

def soft_delete_dataset(db: Session, dataset_id: str, project_id: str) -> bool:
    """
    Soft-delete a dataset by updating is_deleted = 1.
    Checks referential integrity before deletion.
    """
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.project_id == project_id,
        Dataset.is_deleted == 0
    ).first()
    
    if not dataset:
        return False
        
    dataset.is_deleted = 1
    db.commit()
    return True

def get_recent_uploads(db: Session, project_id: str, limit: int = 10) -> List[DatasetUpload]:
    """
    Get recent uploads for a project to restore UI state on refresh.
    """
    return db.query(DatasetUpload)\
        .filter(DatasetUpload.project_id == project_id)\
        .order_by(DatasetUpload.created_at.desc())\
        .limit(limit)\
        .all()

def get_shared_uploads(db: Session) -> List[Dict[str, Any]]:
    datasets = db.query(Dataset).filter(Dataset.is_preloaded == 0, Dataset.uploaded_by != None, Dataset.is_deleted == 0).all()
    seen_paths = set()
    results = []
    for d in datasets:
        if d.storage_path not in seen_paths:
            seen_paths.add(d.storage_path)
            results.append({
                "storage_key": os.path.basename(d.storage_path).replace(".csv", ""),
                "name": d.name,
                "category": d.category,
                "sample_count": d.sample_count,
                "disk_size": d.disk_size,
                "format": d.format,
                "class_count": d.class_count,
                "feature_count": d.feature_count,
                "description": d.description
            })
    return results

def import_shared_upload(db: Session, storage_key: str, project_id: str, user_id: str):
    source_dataset = db.query(Dataset).filter(
        Dataset.storage_path.like(f"%{storage_key}.csv"), 
        Dataset.is_preloaded == 0
    ).first()
    
    if not source_dataset:
        raise ValueError("Shared dataset not found")
        
    dataset_id = str(uuid.uuid4())
    new_dataset = Dataset(
        id=dataset_id,
        slug=f"upload-{storage_key[:8]}-{dataset_id[:8]}",
        project_id=project_id,
        name=source_dataset.name,
        category=source_dataset.category,
        sample_count=source_dataset.sample_count,
        disk_size=source_dataset.disk_size,
        format=source_dataset.format,
        class_count=source_dataset.class_count,
        feature_count=source_dataset.feature_count,
        description=source_dataset.description,
        storage_path=source_dataset.storage_path,
        is_preloaded=0,
        uploaded_by=user_id,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat()
    )
    db.add(new_dataset)
    
    for split in source_dataset.splits:
        db.add(DatasetSplit(id=str(uuid.uuid4()), dataset_id=dataset_id, split_name=split.split_name, sample_count=split.sample_count))
        
    for col in source_dataset.columns:
        db.add(DatasetColumn(
            id=str(uuid.uuid4()), dataset_id=dataset_id, column_name=col.column_name, dtype=col.dtype,
            non_null_count=col.non_null_count, stat_mean=col.stat_mean, stat_min=col.stat_min,
            stat_max=col.stat_max, ordinal=col.ordinal
        ))
        
    for cls in source_dataset.class_distributions:
        db.add(ClassDistribution(
            id=str(uuid.uuid4()), dataset_id=dataset_id, class_name=cls.class_name,
            sample_count=cls.sample_count, ordinal=cls.ordinal
        ))
        
    db.commit()
    return dataset_id
