from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
import uuid
from datetime import datetime

from app.models.model import Model, ModelTag, UserModelStar
from app.schemas.model import ModelCreate

def get_models(db: Session, user_id: Optional[str] = None, search: Optional[str] = None, family: Optional[str] = None, sort_by: str = "forks") -> List[Model]:
    """Retrieve all public models, optionally filtered and sorted."""
    query = db.query(Model).filter(Model.is_public == 1)
    
    if search:
        query = query.filter(
            or_(
                Model.name.ilike(f"%{search}%"),
                Model.full_name.ilike(f"%{search}%"),
                Model.description.ilike(f"%{search}%")
            )
        )
        
    if family and family != "All":
        query = query.filter(Model.family == family)
        
    if sort_by == "accuracy":
        query = query.order_by(Model.top1_acc.desc().nulls_last())
    elif sort_by == "params":
        query = query.order_by(Model.param_count.desc().nulls_last())
    elif sort_by == "name":
        query = query.order_by(Model.name.asc())
    else: # default to forks
        query = query.order_by(Model.fork_count.desc())
        
    models = query.all()
    
    for m in models:
        m.star_count = len(m.stars)
        m.is_starred = any(s.user_id == user_id for s in m.stars) if user_id else False
        
    return models

def get_model_stats(db: Session, user_id: Optional[str] = None) -> dict:
    """Retrieve summary statistics for the model registry."""
    public_models = db.query(Model).filter(Model.is_public == 1).all()
    
    stats = {
        "total_models": len(public_models),
        "cnn_models": sum(1 for m in public_models if m.family == "CNN"),
        "transformer_models": sum(1 for m in public_models if m.family == "Transformer"),
        "classical_models": sum(1 for m in public_models if m.family == "Classical"),
        "seg_det_models": sum(1 for m in public_models if m.family in ("Segmentation", "Detection")),
        "starred_models": 0
    }
    
    if user_id:
        stats["starred_models"] = db.query(UserModelStar).filter(UserModelStar.user_id == user_id).count()
        
    return stats

def get_model_by_slug(db: Session, slug: str) -> Optional[Model]:
    """Retrieve a model by its unique slug."""
    return db.query(Model).filter(Model.slug == slug, Model.is_public == 1).first()

def get_model_by_id(db: Session, model_id: str) -> Optional[Model]:
    """Retrieve a model by its ID."""
    return db.query(Model).filter(Model.id == model_id).first()

def create_model(db: Session, model_in: ModelCreate) -> Model:
    """Create a new model registry entry."""
    db_model = Model(
        id=str(uuid.uuid4()),
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat(),
        fork_count=0,
        **model_in.model_dump()
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model

def toggle_star_model(db: Session, user_id: str, model_id: str) -> bool:
    """Toggles star status for a user and model. Returns True if starred, False if unstarred."""
    existing_star = db.query(UserModelStar).filter(
        UserModelStar.user_id == user_id,
        UserModelStar.model_id == model_id
    ).first()
    
    if existing_star:
        db.delete(existing_star)
        db.commit()
        return False
    
    new_star = UserModelStar(
        user_id=user_id,
        model_id=model_id,
        starred_at=datetime.utcnow().isoformat()
    )
    db.add(new_star)
    db.commit()
    return True
