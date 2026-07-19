from sqlalchemy import Column, String, Integer, ForeignKey
from app.models.base import Base

class Project(Base):
    __tablename__ = "project"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    is_archived = Column(Integer, default=0, nullable=False)
