from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import os
import uuid
import hashlib
from app.core.config import settings

from app.core.database import get_db
from app.api.deps import verify_project_access, get_current_user
from app.models.user import User
from app.schemas.dataset import PreloadedDataset, UploadFileSchema, PresetCatalogSchema, PresetPreviewSchema
from app.services import dataset_service, preset_service

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

@router.get("/presets", response_model=List[PresetCatalogSchema])
def list_presets(
    category: str = "ALL",
    db: Session = Depends(get_db)
):
    """
    UC-MD-XXX: Browse Preset Catalog
    """
    return preset_service.get_presets(db, category)

@router.get("/presets/{preset_key}/preview", response_model=PresetPreviewSchema)
def get_preset_preview(
    preset_key: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve preview schema and distributions for a preset dataset.
    """
    preview = preset_service.get_preset_preview(db, preset_key)
    if not preview:
        raise HTTPException(status_code=404, detail="Preset not found")
    return preview

from fastapi import BackgroundTasks

@router.post("/presets/{preset_key}/import")
def import_preset(
    preset_key: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    project_id: str = Depends(verify_project_access)
):
    """
    Import a preset into the current project via background task.
    """
    preview = preset_service.get_preset_preview(db, preset_key)
    if not preview:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    background_tasks.add_task(preset_service.import_preset_background, preset_key, project_id)
    return {"status": "Import started"}


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
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    project_id: str = Depends(verify_project_access),
    current_user: User = Depends(get_current_user)
):
    """
    UC-MD-005: Upload Pipeline (Initialize)
    """
    shared_uploads_dir = os.path.join(str(settings.DATABASE_PATH).replace("app.db", ""), "datasets", "shared_uploads")
    os.makedirs(shared_uploads_dir, exist_ok=True)
    
    temp_path = os.path.join(shared_uploads_dir, f"temp_{uuid.uuid4()}.csv")
    
    sha256 = hashlib.sha256()
    size = 0
    with open(temp_path, "wb") as buffer:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            sha256.update(chunk)
            buffer.write(chunk)
            size += len(chunk)
            
    file_hash = sha256.hexdigest()
    final_path = os.path.join(shared_uploads_dir, f"{file_hash}.csv")
    
    if os.path.exists(final_path):
        os.remove(temp_path)
    else:
        os.rename(temp_path, final_path)
        
    upload_record = dataset_service.initialize_upload(
        db, file.filename, size, file_hash, project_id, current_user.id
    )
    
    background_tasks.add_task(dataset_service.process_upload_background, file_hash, final_path, project_id, file.filename, upload_record.id)
    return upload_record

@router.get("/uploads/hub", response_model=List[Dict[str, Any]])
def list_shared_uploads(db: Session = Depends(get_db)):
    """
    Returns unique successfully uploaded datasets globally.
    """
    return dataset_service.get_shared_uploads(db)

@router.post("/uploads/hub/{storage_key}/import")
def import_shared_upload(
    storage_key: str,
    db: Session = Depends(get_db),
    project_id: str = Depends(verify_project_access),
    current_user: User = Depends(get_current_user)
):
    """
    Attach an existing uploaded dataset to the current project.
    """
    try:
        dataset_service.import_shared_upload(db, storage_key, project_id, current_user.id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
