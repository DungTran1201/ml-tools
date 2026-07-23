from sqlalchemy import Column, String, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class PresetCatalog(Base):
    __tablename__ = "preset_catalog"
    key = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    description = Column(String)
    default_splits = Column(String)  # Comma-separated like 'train,test'
    class_count = Column(Integer)
    estimated_size = Column(String)
class Dataset(Base):
    __tablename__ = "dataset"
    id = Column(String, primary_key=True)
    slug = Column(String, unique=True, nullable=False)
    project_id = Column(String, ForeignKey("project.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    sample_count = Column(Integer, nullable=False)
    disk_size = Column(String, nullable=False)
    format = Column(String, nullable=False)
    class_count = Column(Integer, nullable=False)
    feature_count = Column(Integer, nullable=False)
    description = Column(String)
    storage_path = Column(String)
    is_preloaded = Column(Integer, default=0, nullable=False)
    uploaded_by = Column(String, ForeignKey("user.id", ondelete="SET NULL"))
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    is_deleted = Column(Integer, default=0, nullable=False)

    splits = relationship("DatasetSplit", back_populates="dataset", cascade="all, delete-orphan", order_by="DatasetSplit.split_name")
    columns = relationship("DatasetColumn", back_populates="dataset", cascade="all, delete-orphan", order_by="DatasetColumn.ordinal")
    class_distributions = relationship("ClassDistribution", back_populates="dataset", cascade="all, delete-orphan", order_by="ClassDistribution.ordinal")
    uploads = relationship("DatasetUpload", back_populates="dataset")


class DatasetSplit(Base):
    __tablename__ = "dataset_split"
    id = Column(String, primary_key=True)
    dataset_id = Column(String, ForeignKey("dataset.id", ondelete="CASCADE"), nullable=False)
    split_name = Column(String, nullable=False)
    sample_count = Column(Integer)
    
    dataset = relationship("Dataset", back_populates="splits")


class DatasetColumn(Base):
    __tablename__ = "dataset_column"
    id = Column(String, primary_key=True)
    dataset_id = Column(String, ForeignKey("dataset.id", ondelete="CASCADE"), nullable=False)
    column_name = Column(String, nullable=False)
    dtype = Column(String, nullable=False)
    non_null_count = Column(Integer, nullable=False)
    stat_mean = Column(String)
    stat_min = Column(String)
    stat_max = Column(String)
    ordinal = Column(Integer, nullable=False)

    dataset = relationship("Dataset", back_populates="columns")


class ClassDistribution(Base):
    __tablename__ = "class_distribution"
    id = Column(String, primary_key=True)
    dataset_id = Column(String, ForeignKey("dataset.id", ondelete="CASCADE"), nullable=False)
    class_name = Column(String, nullable=False)
    sample_count = Column(Integer, nullable=False)
    ordinal = Column(Integer, nullable=False)

    dataset = relationship("Dataset", back_populates="class_distributions")


class DatasetUpload(Base):
    __tablename__ = "dataset_upload"
    id = Column(String, primary_key=True)
    file_name = Column(String, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    upload_progress_pct = Column(Float, default=0, nullable=False)
    status = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("project.id", ondelete="CASCADE"), nullable=False)
    mime_type = Column(String)
    storage_key = Column(String)
    dataset_id = Column(String, ForeignKey("dataset.id", ondelete="SET NULL"))
    error_detail = Column(String)
    started_at = Column(String)
    completed_at = Column(String)
    created_at = Column(String, nullable=False)

    dataset = relationship("Dataset", back_populates="uploads")
