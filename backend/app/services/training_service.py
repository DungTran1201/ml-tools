import uuid
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.training import TrainingRun, HyperparameterConfig, HardwareConfig, RunLog, RunMetric
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.model import Model
from app.models.user import User
from app.schemas.training import TrainingRunLaunch

class TrainingServiceException(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


def launch_run(db: Session, user_id: str, payload: TrainingRunLaunch) -> TrainingRun:
    """Launches a new training run after validating preconditions (PRE-1 to PRE-7)."""
    
    # PRE-1: User is authenticated and active (Assuming user_id is from auth token, but let's double check)
    user = db.query(User).filter(User.id == user_id, User.is_active == 1).first()
    if not user:
        raise TrainingServiceException("User not found or inactive", 401)
        
    # PRE-2: Active project selected
    project = db.query(Project).filter(Project.id == payload.project_id, Project.user_id == user_id, Project.is_archived == 0).first()
    if not project:
        raise TrainingServiceException("Project not found or archived", 404)
        
    # PRE-3: Dataset selected and not soft-deleted
    dataset = db.query(Dataset).filter(Dataset.id == payload.dataset_id, Dataset.project_id == payload.project_id, Dataset.is_deleted == 0).first()
    if not dataset:
        raise TrainingServiceException("Dataset not found", 404)
        
    # PRE-4: Base model (optional)
    if payload.base_model_id:
        model = db.query(Model).filter(Model.id == payload.base_model_id).first()
        if not model:
            raise TrainingServiceException("Base model not found", 404)
            
    # PRE-5: Hyperparameters configured (validated by Pydantic mostly, but we can do extra checks if needed)
    
    # PRE-6: Hardware configuration available
    if payload.hardware_config_id:
        hw_config = db.query(HardwareConfig).filter(HardwareConfig.id == payload.hardware_config_id).first()
        if not hw_config:
            raise TrainingServiceException("Hardware config not found", 404)
            
    # PRE-7: No other run is currently running for this project
    running_count = db.query(func.count(TrainingRun.id)).filter(
        TrainingRun.project_id == payload.project_id,
        TrainingRun.status == 'running'
    ).scalar()
    
    if running_count > 0:
        raise TrainingServiceException("Another run is currently running in this project. Only one active run is allowed per project.", 409)

    # All PRE-conditions passed. Generate IDs and timestamps.
    run_uuid = str(uuid.uuid4())
    
    # Generate user-facing run_id (e.g., 'run-0091') - simple logic for demo
    count_all = db.query(func.count(TrainingRun.id)).scalar()
    run_short_id = f"run-{(count_all + 1):04d}"
    
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%fZ')
    
    # Snapshot of config
    config_json = payload.hyperparameters.model_dump_json()

    # BF-5: Create training run record
    new_run = TrainingRun(
        id=run_uuid,
        run_id=run_short_id,
        name=payload.name,
        epochs_total=int(payload.hyperparameters.epochs),
        epochs_completed=0,
        status='running',
        started_at=now_str,
        project_id=payload.project_id,
        user_id=user_id,
        base_model_id=payload.base_model_id,
        dataset_id=payload.dataset_id,
        hardware_config_id=payload.hardware_config_id,
        config_json=config_json,
        created_at=now_str,
        updated_at=now_str
    )
    db.add(new_run)
    db.flush()
    
    # BF-6: Create initial hyperparameter config (version 1)
    hp_id = str(uuid.uuid4())
    extra_json = json.dumps(payload.hyperparameters.extra) if payload.hyperparameters.extra else "{}"
    
    new_hp = HyperparameterConfig(
        id=hp_id,
        run_id=run_uuid,
        learning_rate=payload.hyperparameters.learning_rate,
        batch_size=payload.hyperparameters.batch_size,
        optimizer=payload.hyperparameters.optimizer,
        scheduler=payload.hyperparameters.scheduler,
        momentum=payload.hyperparameters.momentum,
        weight_decay=payload.hyperparameters.weight_decay,
        dropout=payload.hyperparameters.dropout,
        epochs=payload.hyperparameters.epochs,
        warmup_steps=payload.hyperparameters.warmup_steps,
        grad_clip=payload.hyperparameters.grad_clip,
        extra=extra_json,
        version=1,
        applied_at=now_str
    )
    db.add(new_hp)
    
    db.commit()
    db.refresh(new_run)
    
    return new_run


import time
from typing import Dict, Any

_AGGREGATE_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 3.0  # 3 seconds TTL

def get_run_aggregate(db: Session, run_id: str, project_id: str) -> dict:
    """
    Returns aggregated run details, metrics, and logs.
    Caches the result for a few seconds to prevent heavy DB hits 
    if multiple users/tabs poll the dashboard simultaneously.
    """
    # PRE-2: Ensure the run belongs to the active project
    now = time.time()
    
    # Check cache
    if run_id in _AGGREGATE_CACHE:
        cached_entry = _AGGREGATE_CACHE[run_id]
        if now - cached_entry["time"] < CACHE_TTL:
            return cached_entry["data"]

    run = db.query(TrainingRun).filter(
        TrainingRun.id == run_id, 
        TrainingRun.project_id == project_id
    ).first()
    
    if not run:
        raise TrainingServiceException("Run not found", 404)
        
    # Get last 100 metrics (downsampled conceptually, but just limiting for demo)
    metrics = db.query(RunMetric).filter(RunMetric.run_id == run_id).order_by(RunMetric.step.desc()).limit(100).all()
    metrics.reverse()  # chronological order
    
    # Get last 50 logs
    logs = db.query(RunLog).filter(RunLog.run_id == run_id).order_by(RunLog.line_number.desc()).limit(50).all()
    logs.reverse()
    
    data = {
        "run": {
            "id": run.id,
            "name": run.name,
            "status": run.status,
            "epochs_total": run.epochs_total,
            "epochs_completed": run.epochs_completed,
            "train_loss": run.train_loss,
            "train_acc": run.train_acc,
            "best_val_loss": run.best_val_loss,
            "best_val_acc": run.best_val_acc,
        },
        "metrics": [
            {"step": m.step, "train_loss": m.train_loss, "val_loss": m.val_loss, "train_acc": m.train_acc, "val_acc": m.val_acc}
            for m in metrics
        ],
        "logs": [
            {"line": l.line_number, "message": l.message, "level": l.level}
            for l in logs
        ]
    }
    
    # Update cache
    _AGGREGATE_CACHE[run_id] = {"time": now, "data": data}
    
    return data

def pause_run(db: Session, run_id: str, project_id: str) -> dict:
    run = db.query(TrainingRun).filter(TrainingRun.id == run_id, TrainingRun.project_id == project_id).first()
    if not run:
        raise TrainingServiceException("Run not found", 404)
        
    if run.status != "running":
        raise TrainingServiceException(f"Cannot pause run in status '{run.status}'. Run must be 'running'.", 400)
        
    run.status = "paused"
    run.updated_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%fZ')
    
    # Log the action
    log_entry = RunLog(
        run_id=run.id,
        line_number=run.epochs_completed + 1,
        level="INFO",
        message="Training paused by user.",
        logged_at=int(time.time())
    )
    db.add(log_entry)
    
    db.commit()
    return {"status": "paused"}

def resume_run(db: Session, run_id: str, project_id: str) -> dict:
    run = db.query(TrainingRun).filter(TrainingRun.id == run_id, TrainingRun.project_id == project_id).first()
    if not run:
        raise TrainingServiceException("Run not found", 404)
        
    if run.status != "paused":
        raise TrainingServiceException(f"Cannot resume run in status '{run.status}'. Run must be 'paused'.", 400)
        
    # Check PRE-7 again: no other run is currently running for this project
    from sqlalchemy import func
    running_count = db.query(func.count(TrainingRun.id)).filter(
        TrainingRun.project_id == project_id,
        TrainingRun.status == 'running'
    ).scalar()
    
    if running_count > 0:
        raise TrainingServiceException("Another run is currently running in this project. Pause or stop it before resuming this one.", 409)

    run.status = "running"
    run.updated_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%fZ')
    
    log_entry = RunLog(
        run_id=run.id,
        line_number=run.epochs_completed + 1,
        level="INFO",
        message="Training resumed by user.",
        logged_at=int(time.time())
    )
    db.add(log_entry)
    
    db.commit()
    return {"status": "running"}

def stop_run(db: Session, run_id: str, project_id: str) -> dict:
    run = db.query(TrainingRun).filter(TrainingRun.id == run_id, TrainingRun.project_id == project_id).first()
    if not run:
        raise TrainingServiceException("Run not found", 404)
        
    if run.status not in ["running", "paused"]:
        raise TrainingServiceException(f"Cannot stop run in status '{run.status}'.", 400)
        
    now_ts = int(time.time())
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%fZ')
    
    run.status = "stopped"
    run.finished_at = now_str
    run.updated_at = now_str
    
    log_entry = RunLog(
        run_id=run.id,
        line_number=run.epochs_completed + 1,
        level="WARNING",
        message="Training forcefully stopped by user.",
        logged_at=now_ts
    )
    db.add(log_entry)
    
    db.commit()
    return {"status": "stopped"}

def update_hyperparameters(db: Session, run_id: str, project_id: str, payload_dict: dict) -> dict:
    run = db.query(TrainingRun).filter(TrainingRun.id == run_id, TrainingRun.project_id == project_id).first()
    if not run:
        raise TrainingServiceException("Run not found", 404)
        
    if run.status not in ["running", "paused"]:
        raise TrainingServiceException(f"Cannot update hyperparameters for run in status '{run.status}'.", 400)
        
    # Get the latest config
    latest_config = db.query(HyperparameterConfig).filter(
        HyperparameterConfig.run_id == run_id
    ).order_by(HyperparameterConfig.version.desc()).first()
    
    if not latest_config:
        raise TrainingServiceException("No hyperparameter config found for this run.", 404)
        
    import uuid
    import json
    
    # Extract extra
    extra_str = latest_config.extra
    if "extra" in payload_dict:
        extra_dict = json.loads(extra_str) if extra_str else {}
        extra_dict.update(payload_dict["extra"])
        extra_str = json.dumps(extra_dict)
        
    new_version = latest_config.version + 1
    
    new_config = HyperparameterConfig(
        id=str(uuid.uuid4()),
        run_id=run.id,
        learning_rate=payload_dict.get("learning_rate", latest_config.learning_rate),
        batch_size=payload_dict.get("batch_size", latest_config.batch_size),
        optimizer=payload_dict.get("optimizer", latest_config.optimizer),
        scheduler=payload_dict.get("scheduler", latest_config.scheduler),
        momentum=payload_dict.get("momentum", latest_config.momentum),
        weight_decay=payload_dict.get("weight_decay", latest_config.weight_decay),
        dropout=payload_dict.get("dropout", latest_config.dropout),
        epochs=payload_dict.get("epochs", latest_config.epochs),
        warmup_steps=payload_dict.get("warmup_steps", latest_config.warmup_steps),
        grad_clip=payload_dict.get("grad_clip", latest_config.grad_clip),
        extra=extra_str,
        version=new_version,
        applied_at=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%fZ')
    )
    db.add(new_config)
    
    # Log the update
    log_entry = RunLog(
        run_id=run.id,
        line_number=run.epochs_completed + 1,
        level="INFO",
        message=f"Hyperparameters updated to version {new_version}.",
        logged_at=int(time.time())
    )
    db.add(log_entry)
    
    db.commit()
    return {"status": "updated", "version": new_version}
