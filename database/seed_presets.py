import sys
import os
import uuid
from datetime import datetime

# Add the backend root to sys.path so we can import app modules
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.append(backend_dir)

from app.core.database import SessionLocal
from app.models.dataset import PresetCatalog

def seed_presets():
    db = SessionLocal()
    try:
        presets_to_seed = [
            {
                "key": "iris",
                "name": "Iris",
                "category": "Tabular",
                "provider": "sklearn",
                "description": "Classic dataset in pattern recognition. Contains 3 classes of 50 instances each.",
                "default_splits": "full:100",
                "class_count": 3,
                "estimated_size": "6 KB"
            },
            {
                "key": "wine",
                "name": "Wine Recognition",
                "category": "Tabular",
                "provider": "sklearn",
                "description": "Chemical analysis of wines grown in the same region in Italy but derived from three different cultivars.",
                "default_splits": "full:100",
                "class_count": 3,
                "estimated_size": "11 KB"
            },
            {
                "key": "breast_cancer",
                "name": "Breast Cancer Wisconsin",
                "category": "Tabular",
                "provider": "sklearn",
                "description": "Diagnostic dataset containing features computed from a digitized image of a fine needle aspirate (FNA) of a breast mass.",
                "default_splits": "full:100",
                "class_count": 2,
                "estimated_size": "122 KB"
            },
            {
                "key": "mnist",
                "name": "MNIST",
                "category": "Image",
                "provider": "torchvision",
                "description": "Dataset of 70,000 28x28 grayscale images of the 10 digits.",
                "default_splits": "train:85,test:15",
                "class_count": 10,
                "estimated_size": "50 MB"
            },
            {
                "key": "cifar10",
                "name": "CIFAR-10",
                "category": "Image",
                "provider": "torchvision",
                "description": "60,000 32x32 color images in 10 classes, with 6,000 images per class.",
                "default_splits": "train:83,test:17",
                "class_count": 10,
                "estimated_size": "163 MB"
            },
            {
                "key": "fashion_mnist",
                "name": "Fashion MNIST",
                "category": "Image",
                "provider": "torchvision",
                "description": "A dataset of Zalando's article images—consisting of a training set of 60,000 examples and a test set of 10,000 examples.",
                "default_splits": "train:85,test:15",
                "class_count": 10,
                "estimated_size": "50 MB"
            },
            {
                "key": "synthetic-clf",
                "name": "Synthetic Classification",
                "category": "Tabular",
                "provider": "synthetic",
                "description": "Auto-generated binary classification dataset.",
                "default_splits": "train:100",
                "class_count": 2,
                "estimated_size": "50 KB"
            },
            {
                "key": "glue-sst2",
                "name": "GLUE SST-2",
                "category": "Text",
                "provider": "huggingface",
                "description": "Stanford Sentiment Treebank for binary sentiment classification.",
                "default_splits": "train:50,test:50",
                "class_count": 2,
                "estimated_size": "15 MB"
            },
            {
                "key": "imdb",
                "name": "IMDB Reviews",
                "category": "Text",
                "provider": "huggingface",
                "description": "Large Movie Review Dataset for binary sentiment classification containing 50,000 highly polar movie reviews.",
                "default_splits": "train:50,test:50",
                "class_count": 2,
                "estimated_size": "80 MB"
            },
            {
                "key": "ag_news",
                "name": "AG News",
                "category": "Text",
                "provider": "huggingface",
                "description": "AG is a collection of more than 1 million news articles. This dataset contains 4 news classes.",
                "default_splits": "train:94,test:6",
                "class_count": 4,
                "estimated_size": "30 MB"
            }
        ]

        for p in presets_to_seed:
            existing = db.query(PresetCatalog).filter(PresetCatalog.key == p["key"]).first()
            if not existing:
                preset = PresetCatalog(**p)
                db.add(preset)
                print(f"Created preset catalog entry: {p['name']}")
            else:
                # Update existing
                for k, v in p.items():
                    setattr(existing, k, v)
                print(f"Updated preset catalog entry: {p['name']}")
        
        db.commit()

    except Exception as e:
        db.rollback()
        print(f"Error seeding presets: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_presets()
