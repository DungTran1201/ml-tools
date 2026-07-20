from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_context
from app.schemas.model import ModelSchema, ModelStatsSchema, ModelDownloadResponse
from app.services import model_service

router = APIRouter()

@router.get("/stats", response_model=ModelStatsSchema)
def get_model_stats(
    db: Session = Depends(get_db),
    context: dict = Depends(get_current_context)
):
    """
    View Summary Statistics: Returns aggregate counts for the model registry.
    """
    return model_service.get_model_stats(db, user_id=context.get("user_id"))

@router.get("", response_model=List[ModelSchema])
def list_models(
    search: Optional[str] = Query(None, description="Search by name or description"),
    family: Optional[str] = Query(None, description="Filter by model family"),
    sort_by: str = Query("forks", description="Sort criterion (forks, accuracy, params, name)"),
    db: Session = Depends(get_db),
    context: dict = Depends(get_current_context)
):
    """
    Explore Model Library: List all public models, optionally filtered by search query.
    """
    return model_service.get_models(
        db, 
        user_id=context.get("user_id"),
        search=search, 
        family=family, 
        sort_by=sort_by
    )

@router.get("/{identifier}", response_model=ModelSchema)
def get_model(
    identifier: str,
    db: Session = Depends(get_db)
):
    """
    View Model Detail: Retrieve a model by its slug or ID.
    """
    model = model_service.get_model_by_slug(db, identifier)
    if not model:
        model = model_service.get_model_by_id(db, identifier)
        
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
        
    return model

@router.post("/{model_id}/star", status_code=200)
def toggle_model_star(
    model_id: str,
    db: Session = Depends(get_db),
    context: dict = Depends(get_current_context)
):
    """
    Toggle a user's star for a specific model.
    """
    model = model_service.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
        
    is_starred = model_service.toggle_star_model(db, context["user_id"], model_id)
    return {"starred": is_starred}

@router.get("/{model_id}/download", response_model=ModelDownloadResponse)
def download_model_weights(
    model_id: str,
    db: Session = Depends(get_db),
    context: dict = Depends(get_current_context)
):
    """
    Download Model Weights. Returns a download URL.
    """
    model = model_service.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
        
    url = model.download_url or model.weight_path
    if not url:
        # Mock URL since seed data doesn't have real weights for most models
        url = f"https://mock-weights-server.local/weights/{model.slug}.pt"
        
    return {"download_url": url}
