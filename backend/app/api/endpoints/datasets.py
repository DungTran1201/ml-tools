from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.deps import verify_project_access, get_current_user
from app.models.user import User
from app.schemas.dataset import PreloadedDataset, UploadFileSchema
from app.services import dataset_service

router = APIRouter()

@router.get("", response_model=List[PreloadedDataset])
def list_datasets(
    db: Session = Depends(get_db),
    project_id: str = Depends(verify_project_access)
):
    """
    UC-MD-002: Browse Dataset Library
    Returns all non-deleted datasets for the active project.
    """
    datasets = dataset_service.get_all_datasets(db, project_id)
    return datasets

@router.get("/uploads", response_model=List[UploadFileSchema])
def list_recent_uploads(
    db: Session = Depends(get_db),
    project_id: str = Depends(verify_project_access)
):
    """
    Restore active/recent uploads on page refresh.
    """
    return dataset_service.get_recent_uploads(db, project_id)

@router.get("/{dataset_id}", response_model=PreloadedDataset)
def get_dataset(
    dataset_id: str, 
    db: Session = Depends(get_db),
    project_id: str = Depends(verify_project_access)
):
    """
    UC-MD-003 & UC-MD-004: View Dataset Detail & Schema
    """
    dataset = dataset_service.get_dataset_by_id(db, dataset_id, project_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset

@router.get("/{dataset_id}/export")
def export_dataset(
    dataset_id: str, 
    db: Session = Depends(get_db),
    project_id: str = Depends(verify_project_access)
):
    """
    UC-MD-008: Export Dataset Metadata
    """
    dataset = dataset_service.get_dataset_by_id(db, dataset_id, project_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    dataset_model = PreloadedDataset(**dataset)
    filename = f"dataset_{dataset.get('id', dataset_id)}_metadata.json"
    
    return JSONResponse(
        content=dataset_model.model_dump(by_alias=True),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/upload", response_model=UploadFileSchema)
def upload_dataset(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    project_id: str = Depends(verify_project_access),
    current_user: User = Depends(get_current_user)
):
    """
    UC-MD-005: Upload Pipeline (Initialize)
    """
    upload_record = dataset_service.initialize_upload(
        db, file.filename, project_id, current_user.id
    )
    return upload_record

@router.get("/upload/{upload_id}", response_model=UploadFileSchema)
def get_upload_status(upload_id: str, db: Session = Depends(get_db)):
    """
    UC-MD-006: Upload Pipeline Status
    """
    upload_record = dataset_service.get_upload_status(db, upload_id)
    if not upload_record:
        raise HTTPException(status_code=404, detail="Upload not found")
    return upload_record

@router.delete("/upload/{upload_id}", status_code=204)
def remove_upload_entry(
    upload_id: str,
    db: Session = Depends(get_db),
    project_id: str = Depends(verify_project_access),
    current_user: User = Depends(get_current_user)
):
    """
    UC-MD-007: Remove / Dismiss Upload Entry
    """
    success = dataset_service.remove_upload(db, upload_id, project_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Upload entry not found or permission denied")
    return None

@router.delete("/{dataset_id}", status_code=204)
def soft_delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    project_id: str = Depends(verify_project_access)
):
    """
    UC-MD-009: Soft-Delete Dataset
    """
    success = dataset_service.soft_delete_dataset(db, dataset_id, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dataset not found or permission denied")
    return None
