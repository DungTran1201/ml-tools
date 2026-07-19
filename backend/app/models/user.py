from sqlalchemy import Column, String, Integer
from app.models.base import Base

class User(Base):
    __tablename__ = "user"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    avatar_url = Column(String)
    created_at = Column(String, nullable=False)
    last_login_at = Column(String)
    is_active = Column(Integer, default=1, nullable=False)
