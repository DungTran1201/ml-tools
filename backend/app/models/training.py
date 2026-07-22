from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.base import Base

class HardwareConfig(Base):
    __tablename__ = "hardware_config"
    id = Column(String, primary_key=True)
    gpu_model = Column(String, nullable=False)
    gpu_count = Column(Integer, nullable=False)
    cpu_model = Column(String, nullable=False)
    ram_total_gb = Column(Integer, nullable=False)
    storage_type = Column(String)
    created_at = Column(String, nullable=False)


class TrainingRun(Base):
    __tablename__ = "training_run"
    id = Column(String, primary_key=True)
    run_id = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    epochs_total = Column(Integer, nullable=False)
    epochs_completed = Column(Integer, default=0, nullable=False)
    best_val_acc = Column(Float)
    best_val_loss = Column(Float)
    train_acc = Column(Float)
    train_loss = Column(Float)
    training_time_sec = Column(Integer)
    param_count = Column(String)
    status = Column(String, nullable=False)
    started_at = Column(String, nullable=False)
    
    project_id = Column(String, ForeignKey("project.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("user.id", ondelete="RESTRICT"), nullable=False)
    base_model_id = Column(String, ForeignKey("model.id", ondelete="SET NULL"))
    dataset_id = Column(String, ForeignKey("dataset.id", ondelete="RESTRICT"), nullable=False)
    hardware_config_id = Column(String, ForeignKey("hardware_config.id", ondelete="SET NULL"))
    
    finished_at = Column(String)
    error_message = Column(String)
    checkpoint_path = Column(String)
    config_json = Column(Text)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    is_deleted = Column(Integer, default=0, nullable=False)


class RunMetric(Base):
    __tablename__ = "run_metric"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("training_run.id", ondelete="CASCADE"), nullable=False)
    step = Column(Integer, nullable=False)
    train_loss = Column(Float, nullable=False)
    val_loss = Column(Float)
    train_acc = Column(Float, nullable=False)
    val_acc = Column(Float)
    recorded_at = Column(Integer, nullable=False)


class RunLog(Base):
    __tablename__ = "run_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("training_run.id", ondelete="CASCADE"), nullable=False)
    line_number = Column(Integer, nullable=False)
    level = Column(String, nullable=False)
    message = Column(String, nullable=False)
    logged_at = Column(Integer, nullable=False)


class HyperparameterConfig(Base):
    __tablename__ = "hyperparameter_config"
    id = Column(String, primary_key=True)
    run_id = Column(String, ForeignKey("training_run.id", ondelete="CASCADE"), nullable=False)
    learning_rate = Column(String, nullable=False)
    batch_size = Column(String, nullable=False)
    optimizer = Column(String, nullable=False)
    scheduler = Column(String)
    momentum = Column(String)
    weight_decay = Column(String)
    dropout = Column(String)
    epochs = Column(String, nullable=False)
    warmup_steps = Column(String)
    grad_clip = Column(String)
    extra = Column(Text, default="{}", nullable=False)
    version = Column(Integer, default=1, nullable=False)
    applied_at = Column(String, nullable=False)


class HardwareMetric(Base):
    __tablename__ = "hardware_metric"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("training_run.id", ondelete="SET NULL"))
    epoch = Column(Integer)
    gpu_index = Column(Integer, nullable=False)
    gpu_util_pct = Column(Float, nullable=False)
    gpu_temp_c = Column(Float, nullable=False)
    gpu_power_w = Column(Float)
    vram_used_gb = Column(Float, nullable=False)
    vram_total_gb = Column(Float, nullable=False)
    cpu_util_pct = Column(Float, nullable=False)
    ram_used_gb = Column(Float, nullable=False)
    ram_total_gb = Column(Float, nullable=False)
    disk_read_gbps = Column(Float)
    disk_write_gbps = Column(Float)
    net_rx_gbps = Column(Float)
    net_tx_gbps = Column(Float)
    recorded_at = Column(Integer, nullable=False)


class Checkpoint(Base):
    __tablename__ = "checkpoint"
    id = Column(String, primary_key=True)
    run_id = Column(String, ForeignKey("training_run.id", ondelete="CASCADE"), nullable=False)
    epoch = Column(Integer, nullable=False)
    file_path = Column(String, nullable=False)
    file_size_bytes = Column(Integer)
    val_acc = Column(Float)
    val_loss = Column(Float)
    is_best = Column(Integer, default=0, nullable=False)
    created_at = Column(String, nullable=False)


class RunTag(Base):
    __tablename__ = "run_tag"
    id = Column(String, primary_key=True)
    run_id = Column(String, ForeignKey("training_run.id", ondelete="CASCADE"), nullable=False)
    tag = Column(String, nullable=False)
