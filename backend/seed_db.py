import os
import sys
import uuid
import datetime

# Add the backend dir to sys.path to resolve 'app' imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.core.database import engine, SessionLocal
from app.models.base import Base

# Import all models so Base.metadata knows about them
from app.models import (
    User, Project, ProjectMember,
    TrainingRun, RunMetric, RunLog, HyperparameterConfig,
    HardwareConfig, HardwareMetric, Checkpoint, RunTag,
    Dataset, DatasetSplit, DatasetColumn, ClassDistribution, DatasetUpload,
    Model, ModelTag, UserModelStar
)

def init_db():
    print(f"Initializing database at {settings.DATABASE_PATH}...")
    
    # Ensure database directory exists
    os.makedirs(os.path.dirname(settings.DATABASE_PATH), exist_ok=True)
    
    # Drop and recreate all tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("All tables created successfully.")

def seed_db():
    db = SessionLocal()
    try:
        # Create a mock User
        user_id = str(uuid.uuid4())
        mock_user = User(
            id=user_id,
            email="data.scientist@example.com",
            display_name="Data Scientist",
            password_hash="mock_hash",
            created_at=datetime.datetime.now().isoformat()
        )
        db.add(mock_user)
        db.flush()
        
        # Create a mock Project
        project_id = str(uuid.uuid4())
        mock_project = Project(
            id=project_id,
            user_id=user_id,
            name="Alpha Computer Vision",
            description="Main project for computer vision experiments.",
            created_at=datetime.datetime.now().isoformat(),
            updated_at=datetime.datetime.now().isoformat()
        )
        db.add(mock_project)
        db.flush()
        
        # Create a mock ProjectMember (Owner)
        mock_member = ProjectMember(
            project_id=project_id,
            user_id=user_id,
            role="Owner",
            created_at=datetime.datetime.now().isoformat()
        )
        db.add(mock_member)
        db.flush()

        # Create a mock Model (Base Model)
        model_id = str(uuid.uuid4())
        mock_model = Model(
            id=model_id,
            slug="resnet50",
            name="ResNet-50",
            full_name="Residual Networks 50",
            family="CNN",
            param_count=25000000,
            created_at=datetime.datetime.now().isoformat(),
            updated_at=datetime.datetime.now().isoformat()
        )
        db.add(mock_model)
        db.flush()
        
        # Create a mock Dataset
        dataset_id = str(uuid.uuid4())
        mock_dataset = Dataset(
            id=dataset_id,
            slug="imagenet-mini",
            project_id=project_id,
            name="ImageNet Mini",
            category="Image",
            sample_count=10000,
            disk_size="1 GB",
            format="JPEG",
            class_count=100,
            feature_count=0,
            created_at=datetime.datetime.now().isoformat(),
            updated_at=datetime.datetime.now().isoformat()
        )
        db.add(mock_dataset)
        db.flush()
        
        # Create a mock HardwareConfig
        hw_config_id = str(uuid.uuid4())
        mock_hw = HardwareConfig(
            id=hw_config_id,
            gpu_model="NVIDIA A100",
            gpu_count=4,
            cpu_model="AMD EPYC 7742",
            ram_total_gb=256,
            storage_type="NVMe SSD",
            created_at=datetime.datetime.now().isoformat()
        )
        db.add(mock_hw)
        db.flush()

        db.commit()
        print("Mock data seeded successfully!")
        
        print("\n--- Seeded Identifiers ---")
        print(f"User ID: {user_id}")
        print(f"Project ID: {project_id}")
        print(f"Model ID: {model_id}")
        print(f"Dataset ID: {dataset_id}")
        print(f"Hardware Config ID: {hw_config_id}")
        print("--------------------------")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    seed_db()
