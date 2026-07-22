from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any

class HyperparametersSchema(BaseModel):
    learning_rate: str
    batch_size: str
    optimizer: str
    epochs: str
    scheduler: Optional[str] = None
    momentum: Optional[str] = None
    weight_decay: Optional[str] = None
    dropout: Optional[str] = None
    warmup_steps: Optional[str] = None
    grad_clip: Optional[str] = None
    extra: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    model_config = ConfigDict(from_attributes=True)


class TrainingRunLaunch(BaseModel):
    name: str
    project_id: str
    dataset_id: str
    base_model_id: Optional[str] = None
    hardware_config_id: Optional[str] = None
    hyperparameters: HyperparametersSchema


class TrainingRunResponse(BaseModel):
    id: str
    run_id: str
    name: str
    epochs_total: int
    epochs_completed: int
    status: str
    started_at: str
    finished_at: Optional[str] = None
    training_time_sec: Optional[int] = None
    best_val_acc: Optional[float] = None
    best_val_loss: Optional[float] = None
    train_acc: Optional[float] = None
    train_loss: Optional[float] = None
    checkpoint_path: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class RunMetricSchema(BaseModel):
    step: int
    train_loss: float
    val_loss: Optional[float] = None
    train_acc: float
    val_acc: Optional[float] = None
    recorded_at: int
    
    model_config = ConfigDict(from_attributes=True)


class RunLogSchema(BaseModel):
    line_number: int
    level: str
    message: str
    logged_at: int
    
    model_config = ConfigDict(from_attributes=True)


class RunActionSchema(BaseModel):
    action: str

