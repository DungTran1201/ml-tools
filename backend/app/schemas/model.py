from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class ModelTagSchema(BaseModel):
    id: str
    tag: str
    
    model_config = ConfigDict(from_attributes=True)

class ModelBase(BaseModel):
    slug: str
    name: str
    full_name: str
    family: str
    param_count: Optional[int] = None
    flops: Optional[int] = None
    top1_acc: Optional[float] = None
    input_size: Optional[str] = None
    depth: Optional[int] = None
    source: Optional[str] = None
    description: Optional[str] = None
    architecture_svg: Optional[str] = None
    download_url: Optional[str] = None
    weight_path: Optional[str] = None
    is_public: int = 1

class ModelCreate(ModelBase):
    pass

class ModelUpdate(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    family: Optional[str] = None
    param_count: Optional[int] = None
    flops: Optional[int] = None
    top1_acc: Optional[float] = None
    input_size: Optional[str] = None
    depth: Optional[int] = None
    source: Optional[str] = None
    description: Optional[str] = None
    architecture_svg: Optional[str] = None
    download_url: Optional[str] = None
    weight_path: Optional[str] = None
    is_public: Optional[int] = None

class ModelSchema(ModelBase):
    id: str
    fork_count: int
    created_at: str
    updated_at: str
    tags: List[ModelTagSchema] = []
    star_count: int = 0
    is_starred: bool = False

    model_config = ConfigDict(from_attributes=True)

class ModelStatsSchema(BaseModel):
    total_models: int
    cnn_models: int
    transformer_models: int
    classical_models: int
    seg_det_models: int
    starred_models: int

class ModelDownloadResponse(BaseModel):
    download_url: str
