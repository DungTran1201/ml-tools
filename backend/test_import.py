import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.preset_service import import_preset_background
from app.core.database import SessionLocal
from app.models.dataset import Dataset, DatasetSplit, DatasetColumn, ClassDistribution

def test_import():
    project_id = "5dac3f03-88f7-485d-bf06-f1ae8039d0f9" # Seed project ID
    preset_key = "iris"
    
    print(f"Importing preset {preset_key}...")
    import_preset_background(preset_key, project_id)
    print("Import finished.")
    
    db = SessionLocal()
    dataset = db.query(Dataset).filter(Dataset.project_id == project_id, Dataset.name == "Iris Dataset").first()
    
    if dataset:
        print(f"Found dataset: {dataset.name} (is_preloaded={dataset.is_preloaded})")
        splits = db.query(DatasetSplit).filter(DatasetSplit.dataset_id == dataset.id).all()
        print(f"Splits: {[s.split_name for s in splits]}")
        columns = db.query(DatasetColumn).filter(DatasetColumn.dataset_id == dataset.id).all()
        print(f"Columns: {[c.column_name for c in columns]}")
        classes = db.query(ClassDistribution).filter(ClassDistribution.dataset_id == dataset.id).all()
        print(f"Classes: {[c.class_name for c in classes]}")
    else:
        print("Dataset not found!")
        
if __name__ == "__main__":
    test_import()
