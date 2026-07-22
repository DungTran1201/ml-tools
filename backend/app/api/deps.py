from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.project import Project, ProjectMember

def get_current_user(db: Session = Depends(get_db)):
    """
    Mock authentication dependency for development.
    Returns the first user in the database.
    In a real app, this would verify a JWT token.
    """
    user = db.query(User).filter(User.email == "data.scientist@example.com").first()
    if not user:
        raise HTTPException(status_code=500, detail="Default user not found. Please run the seeder.")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
        
    return user

def verify_project_access(
    x_project_id: str = Header(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> str:
    """
    Dependency to enforce multi-tenant isolation.
    Extracts X-Project-ID header and verifies the user has access.
    Returns the project_id to be used in WHERE clauses.
    """
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == x_project_id,
        ProjectMember.user_id == current_user.id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=403, 
            detail="Access Denied: You do not have access to this project or it does not exist."
        )
        
    project = db.query(Project).filter(Project.id == x_project_id).first()
    if not project or project.is_archived == 1:
        raise HTTPException(
            status_code=403,
            detail="Project is archived. Actions are read-only or blocked."
        )
        
    return x_project_id

def get_current_context(db: Session = Depends(get_db)):
    """
    Temporary dependency for development (for existing endpoints).
    Returns the default user and project IDs.
    """
    user = db.query(User).filter(User.email == "data.scientist@example.com").first()
    if not user:
        raise HTTPException(status_code=500, detail="Default user not found. Did you run the seeder?")
        
    project = db.query(Project).filter(Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=500, detail="Default project not found. Did you run the seeder?")
        
    return {"user_id": user.id, "project_id": project.id}
