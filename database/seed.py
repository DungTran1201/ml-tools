import sys
import os
import uuid
from datetime import datetime

# Add the backend root to sys.path so we can import app modules
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.append(backend_dir)

from app.core.database import SessionLocal
from app.models.user import User
from app.models.project import Project

def seed():
    db = SessionLocal()
    try:
        # 1. Seed Default User
        default_email = "default_user@ml-tools.local"
        user = db.query(User).filter(User.email == default_email).first()
        if not user:
            user = User(
                id=str(uuid.uuid4()),
                email=default_email,
                display_name="Default Developer",
                password_hash="fake_hash",
                created_at=datetime.utcnow().isoformat()
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created default user: {user.id}")
        else:
            print(f"Default user already exists: {user.id}")

        # 2. Seed Default Project
        default_project_name = "Default Project"
        project = db.query(Project).filter(Project.name == default_project_name, Project.user_id == user.id).first()
        if not project:
            project = Project(
                id=str(uuid.uuid4()),
                user_id=user.id,
                name=default_project_name,
                description="Auto-generated default project for development.",
                created_at=datetime.utcnow().isoformat(),
                updated_at=datetime.utcnow().isoformat()
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            print(f"Created default project: {project.id}")
        else:
            print(f"Default project already exists: {project.id}")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
