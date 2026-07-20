from sqlalchemy import Column, String, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class Model(Base):
    __tablename__ = "model"
    id = Column(String, primary_key=True)
    slug = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    family = Column(String, nullable=False)
    param_count = Column(Integer)
    flops = Column(Integer)
    top1_acc = Column(Float)
    input_size = Column(String)
    depth = Column(Integer)
    source = Column(String)
    description = Column(String)
    fork_count = Column(Integer, nullable=False, default=0)
    architecture_svg = Column(String)
    download_url = Column(String)
    weight_path = Column(String)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    is_public = Column(Integer, nullable=False, default=1)

    tags = relationship("ModelTag", back_populates="model", cascade="all, delete-orphan")
    stars = relationship("UserModelStar", back_populates="model", cascade="all, delete-orphan")

class ModelTag(Base):
    __tablename__ = "model_tag"
    id = Column(String, primary_key=True)
    model_id = Column(String, ForeignKey("model.id", ondelete="CASCADE"), nullable=False)
    tag = Column(String, nullable=False)

    model = relationship("Model", back_populates="tags")

class UserModelStar(Base):
    __tablename__ = "user_model_star"
    user_id = Column(String, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    model_id = Column(String, ForeignKey("model.id", ondelete="CASCADE"), primary_key=True)
    starred_at = Column(String, nullable=False)

    model = relationship("Model", back_populates="stars")
