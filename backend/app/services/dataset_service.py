from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

from app.models.dataset import Dataset, DatasetUpload
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

def initialize_upload(db: Session, filename: str, project_id: str, user_id: str) -> DatasetUpload:
    new_upload = DatasetUpload(
        id=str(uuid.uuid4()),
        file_name=filename,
        file_size_bytes=1024 * 1024 * 2, # 2MB dummy size for mock
        upload_progress_pct=10.0,
        status="uploading",
        user_id=user_id,
        project_id=project_id,
        created_at=datetime.utcnow().isoformat()
    )
    db.add(new_upload)
    db.commit()
    db.refresh(new_upload)
    return new_upload

def get_upload_status(db: Session, upload_id: str) -> Optional[DatasetUpload]:
    upload = db.query(DatasetUpload).filter(DatasetUpload.id == upload_id).first()
    if not upload:
        return None
        
    # Simulate background processing by advancing progress on read
    if upload.status == "uploading":
        upload.upload_progress_pct += 30.0
        if upload.upload_progress_pct >= 100.0:
            upload.upload_progress_pct = 100.0
            upload.status = "validating"
        db.commit()
        db.refresh(upload)
    elif upload.status == "validating":
        upload.status = "valid"
        db.commit()
        db.refresh(upload)
        
    return upload

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
