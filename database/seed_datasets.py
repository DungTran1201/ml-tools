import sys
import os
import uuid
from datetime import datetime

# Add the backend root to sys.path so we can import app modules
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.append(backend_dir)

from app.core.database import SessionLocal
from app.models.dataset import Dataset, DatasetSplit, DatasetColumn, ClassDistribution
from app.models.project import Project

def seed_datasets():
    db = SessionLocal()
    try:
        # Find the default project to associate these datasets with
        default_project = db.query(Project).filter(Project.name == "Default Project").first()
        if not default_project:
            print("Error: Default Project not found. Please run seed.py first.")
            return

        datasets_to_seed = [
            {
                "slug": "imagenet",
                "name": "ImageNet-1K",
                "category": "Image",
                "sample_count": 1281167,
                "disk_size": "138 GB",
                "format": "JPEG",
                "class_count": 1000,
                "feature_count": 3,
                "description": "Large-scale image classification benchmark with 1000 categories.",
                "splits": [
                    {"name": "train", "count": 1231167},
                    {"name": "val", "count": 50000}
                ],
                "columns": [
                    {"name": "image", "dtype": "PIL.Image", "non_null": 1281167},
                    {"name": "label", "dtype": "int64", "non_null": 1281167}
                ],
                "distributions": [
                    {"name": "dog", "count": 1300},
                    {"name": "cat", "count": 1300},
                    {"name": "car", "count": 1300}
                ]
            },
            {
                "slug": "cifar-10",
                "name": "CIFAR-10",
                "category": "Image",
                "sample_count": 60000,
                "disk_size": "163 MB",
                "format": "Binary",
                "class_count": 10,
                "feature_count": 3,
                "description": "Tiny images dataset containing 60,000 32x32 color images in 10 classes.",
                "splits": [
                    {"name": "train", "count": 50000},
                    {"name": "test", "count": 10000}
                ],
                "columns": [
                    {"name": "image", "dtype": "numpy.ndarray", "non_null": 60000},
                    {"name": "label", "dtype": "int64", "non_null": 60000}
                ],
                "distributions": [
                    {"name": "airplane", "count": 6000},
                    {"name": "automobile", "count": 6000},
                    {"name": "bird", "count": 6000},
                    {"name": "cat", "count": 6000}
                ]
            },
            {
                "slug": "mnist",
                "name": "MNIST",
                "category": "Image",
                "sample_count": 70000,
                "disk_size": "11 MB",
                "format": "IDX",
                "class_count": 10,
                "feature_count": 1,
                "description": "Dataset of 70,000 28x28 grayscale images of the 10 digits.",
                "splits": [
                    {"name": "train", "count": 60000},
                    {"name": "test", "count": 10000}
                ],
                "columns": [
                    {"name": "image", "dtype": "numpy.ndarray", "non_null": 70000},
                    {"name": "label", "dtype": "int64", "non_null": 70000}
                ],
                "distributions": [
                    {"name": "0", "count": 6903},
                    {"name": "1", "count": 7877},
                    {"name": "2", "count": 6990},
                    {"name": "3", "count": 7141},
                    {"name": "4", "count": 6824}
                ]
            },
            {
                "slug": "iris",
                "name": "Iris",
                "category": "Tabular",
                "sample_count": 150,
                "disk_size": "6 KB",
                "format": "CSV",
                "class_count": 3,
                "feature_count": 4,
                "description": "Classic dataset in pattern recognition. Contains 3 classes of 50 instances each.",
                "splits": [
                    {"name": "full", "count": 150}
                ],
                "columns": [
                    {"name": "sepal_length", "dtype": "float64", "non_null": 150, "mean": "5.84", "min": "4.3", "max": "7.9"},
                    {"name": "sepal_width", "dtype": "float64", "non_null": 150, "mean": "3.05", "min": "2.0", "max": "4.4"},
                    {"name": "petal_length", "dtype": "float64", "non_null": 150, "mean": "3.75", "min": "1.0", "max": "6.9"},
                    {"name": "petal_width", "dtype": "float64", "non_null": 150, "mean": "1.19", "min": "0.1", "max": "2.5"},
                    {"name": "species", "dtype": "string", "non_null": 150}
                ],
                "distributions": [
                    {"name": "setosa", "count": 50},
                    {"name": "versicolor", "count": 50},
                    {"name": "virginica", "count": 50}
                ]
            }
        ]

        for data in datasets_to_seed:
            dataset = db.query(Dataset).filter(Dataset.slug == data["slug"], Dataset.project_id == default_project.id).first()
            if not dataset:
                ds_id = data["slug"]
                now = datetime.utcnow().isoformat()
                dataset = Dataset(
                    id=ds_id,
                    slug=data["slug"],
                    project_id=default_project.id,
                    name=data["name"],
                    category=data["category"],
                    sample_count=data["sample_count"],
                    disk_size=data["disk_size"],
                    format=data["format"],
                    class_count=data["class_count"],
                    feature_count=data["feature_count"],
                    description=data["description"],
                    is_preloaded=1,
                    created_at=now,
                    updated_at=now
                )
                db.add(dataset)
                
                # Splits
                for split_data in data["splits"]:
                    db.add(DatasetSplit(
                        id=str(uuid.uuid4()),
                        dataset_id=ds_id,
                        split_name=split_data["name"],
                        sample_count=split_data["count"]
                    ))
                
                # Columns
                for i, col_data in enumerate(data["columns"]):
                    db.add(DatasetColumn(
                        id=str(uuid.uuid4()),
                        dataset_id=ds_id,
                        column_name=col_data["name"],
                        dtype=col_data["dtype"],
                        non_null_count=col_data["non_null"],
                        stat_mean=col_data.get("mean"),
                        stat_min=col_data.get("min"),
                        stat_max=col_data.get("max"),
                        ordinal=i
                    ))

                # Distributions
                for i, dist_data in enumerate(data["distributions"]):
                    db.add(ClassDistribution(
                        id=str(uuid.uuid4()),
                        dataset_id=ds_id,
                        class_name=dist_data["name"],
                        sample_count=dist_data["count"],
                        ordinal=i
                    ))

                db.commit()
                print(f"Created preloaded dataset: {data['name']}")
            else:
                print(f"Dataset already exists: {data['name']}")

    finally:
        db.close()

if __name__ == "__main__":
    seed_datasets()
