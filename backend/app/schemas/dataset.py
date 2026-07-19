from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import List, Optional, Dict, Any

class ClassDistributionSchema(BaseModel):
    name: str = Field(validation_alias="class_name", serialization_alias="name")
    count: int = Field(validation_alias="sample_count", serialization_alias="count")
    
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class ColumnSchema(BaseModel):
    column: str = Field(validation_alias="column_name", serialization_alias="column")
    dtype: str
    nonNull: int = Field(validation_alias="non_null_count", serialization_alias="nonNull")
    mean: Optional[str] = Field(None, validation_alias="stat_mean", serialization_alias="mean")
    min: Optional[str] = Field(None, validation_alias="stat_min", serialization_alias="min")
    max: Optional[str] = Field(None, validation_alias="stat_max", serialization_alias="max")
    
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class PreloadedDataset(BaseModel):
    id: str
    name: str
    category: str
    samples: int = Field(validation_alias="sample_count", serialization_alias="samples")
    size: str = Field(validation_alias="disk_size", serialization_alias="size")
    format: str
    classes: int = Field(validation_alias="class_count", serialization_alias="classes")
    features: int = Field(validation_alias="feature_count", serialization_alias="features")
    splits: List[str]
    description: Optional[str] = None
    classDistribution: List[ClassDistributionSchema] = Field(
        default_factory=list, 
        validation_alias="class_distributions",
        serialization_alias="classDistribution"
    )
    schema_fields: List[ColumnSchema] = Field(
        default_factory=list, 
        validation_alias="columns", 
        serialization_alias="schema"
    )
    sampleRows: List[Dict[str, Any]] = Field(default_factory=list)

    @model_validator(mode='before')
    @classmethod
    def process_orm_fields(cls, data: Any):
        if not isinstance(data, dict):
            # If data is an ORM model, convert to dict explicitly to handle 'splits'
            data_dict = {
                "id": data.id,
                "name": data.name,
                "category": data.category,
                "sample_count": data.sample_count,
                "disk_size": data.disk_size,
                "format": data.format,
                "class_count": data.class_count,
                "feature_count": data.feature_count,
                "description": data.description,
                "splits": [s.split_name for s in getattr(data, "splits", [])],
                "class_distributions": getattr(data, "class_distributions", []),
                "columns": getattr(data, "columns", []),
                "sampleRows": getattr(data, "sampleRows", []),
            }
            return data_dict
        return data

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class UploadFileSchema(BaseModel):
    id: str
    name: str = Field(validation_alias="file_name", serialization_alias="name")
    size: int = Field(validation_alias="file_size_bytes", serialization_alias="size")
    progress: float = Field(validation_alias="upload_progress_pct", serialization_alias="progress")
    status: str
    
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
