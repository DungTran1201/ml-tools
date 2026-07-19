from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.project import Project

def get_current_context(db: Session = Depends(get_db)):
    """
    Temporary dependency for development.
    Returns the default user and project IDs.
    """
    user = db.query(User).filter(User.email == "default_user@ml-tools.local").first()
    if not user:
        raise HTTPException(status_code=500, detail="Default user not found. Did you run the seeder?")
        
    project = db.query(Project).filter(Project.user_id == user.id, Project.name == "Default Project").first()
    if not project:
        raise HTTPException(status_code=500, detail="Default project not found. Did you run the seeder?")
        
    return {"user_id": user.id, "project_id": project.id}
