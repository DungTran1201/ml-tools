from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import datetime

class ProjectMemberBase(BaseModel):
    user_id: str
    role: str

class ProjectMemberRead(ProjectMemberBase):
    project_id: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)

class ProjectBase(BaseModel):
    name: str = Field(..., max_length=50)
    description: Optional[str] = Field(None, max_length=250)

class ProjectCreate(ProjectBase):
    pass

class ProjectRead(ProjectBase):
    id: str
    user_id: str
    created_at: str
    updated_at: str
    is_archived: int
    # members: Optional[List[ProjectMemberRead]] = [] # Can be populated if needed

    model_config = ConfigDict(from_attributes=True)
