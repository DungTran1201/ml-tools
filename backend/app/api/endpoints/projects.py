from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid
import datetime

from app.core.database import get_db
from app.api.deps import get_current_user, verify_project_access
from app.models.user import User
from app.models.project import Project, ProjectMember
from app.schemas.project import ProjectCreate, ProjectRead

router = APIRouter()

@router.post("/", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new project.
    Automatically assigns the current user as the "Owner".
    """
    project_id = str(uuid.uuid4())
    now = datetime.datetime.now().isoformat()
    
    # Create the project
    new_project = Project(
        id=project_id,
        user_id=current_user.id,
        name=project_in.name,
        description=project_in.description,
        created_at=now,
        updated_at=now,
        is_archived=0
    )
    db.add(new_project)
    
    # Assign Owner role
    owner_member = ProjectMember(
        project_id=project_id,
        user_id=current_user.id,
        role="Owner",
        created_at=now
    )
    db.add(owner_member)
    
    try:
        db.commit()
        db.refresh(new_project)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database transaction failed")
        
    return new_project


@router.get("/", response_model=List[ProjectRead])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all projects the current user has access to.
    Filtered by checking project_member table.
    """
    projects = (
        db.query(Project)
        .join(ProjectMember, Project.id == ProjectMember.project_id)
        .filter(ProjectMember.user_id == current_user.id)
        .filter(Project.is_archived == 0)
        .all()
    )
    return projects


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get project details. Used when switching active context.
    Verifies the user is a member of the project.
    """
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == current_user.id
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this project")
        
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return project

@router.post("/{project_id}/archive")
def archive_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Just a simple endpoint for testing step 10
    from app.models.project import ProjectMember
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
        
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Not found")
        
    project.is_archived = 1
    db.commit()
    return {"status": "archived"}

@router.get("/isolation/test")
def test_isolation(
    active_project_id: str = Depends(verify_project_access)
):
    """
    Test endpoint to verify X-Project-ID header extraction and RBAC.
    """
    return {"status": "success", "active_project_id": active_project_id}
