from abc import ABC, abstractmethod
import os
import uuid
import json
from typing import Dict, Any, Tuple
from app.core.config import settings

class BaseDatasetProvider(ABC):
    @abstractmethod
    def download_and_extract(self, preset_key: str, storage_path: str) -> Dict[str, Any]:
        """
        Downloads/generates the dataset, saves it to storage_path.
        Returns a dictionary with extracted metadata:
        {
            "format": str,
            "sample_count": int,
            "class_count": int,
            "feature_count": int,
            "disk_size": str,
            "splits": list of dicts {"split_name": str, "sample_count": int},
            "columns": list of dicts {"column_name": str, "dtype": str, "non_null_count": int, "stat_mean": str, "stat_min": str, "stat_max": str, "ordinal": int},
            "class_distributions": list of dicts {"class_name": str, "sample_count": int, "ordinal": int}
        }
        """
        pass

class SklearnProvider(BaseDatasetProvider):
    def download_and_extract(self, preset_key: str, storage_path: str) -> Dict[str, Any]:
        # ponytail: dynamic import to avoid hard dependency if not used
        from sklearn.datasets import load_iris
        import pandas as pd
        import numpy as np
        
        if preset_key == "iris":
            data = load_iris()
        elif preset_key == "wine":
            from sklearn.datasets import load_wine
            data = load_wine()
        elif preset_key == "breast_cancer":
            from sklearn.datasets import load_breast_cancer
            data = load_breast_cancer()
        else:
            raise ValueError(f"Unknown sklearn preset: {preset_key}")
            
        df = pd.DataFrame(data.data, columns=data.feature_names)
        df['target'] = data.target
        
        os.makedirs(storage_path, exist_ok=True)
        file_path = os.path.join(storage_path, f"{preset_key}.csv")
        df.to_csv(file_path, index=False)
        sample_count = len(df)
        
        columns = []
        for i, col in enumerate(df.columns):
            columns.append({
                "column_name": col,
                "dtype": str(df[col].dtype),
                "non_null_count": sample_count,
                "stat_mean": str(df[col].mean()) if col != 'target' else None,
                "stat_min": str(df[col].min()) if col != 'target' else None,
                "stat_max": str(df[col].max()) if col != 'target' else None,
                "ordinal": i
            })
        
        class_counts = df['target'].value_counts().to_dict()
        class_distributions = []
        for i, target_name in enumerate(data.target_names):
            class_distributions.append({
                "class_name": target_name,
                "sample_count": int(class_counts.get(i, 0)),
                "ordinal": i
            })
                
        return {
            "format": "CSV",
            "sample_count": sample_count,
            "class_count": len(data.target_names),
            "feature_count": len(data.feature_names),
            "disk_size": f"{os.path.getsize(file_path) / 1024:.2f} KB",
            "splits": [{"split_name": "train", "sample_count": sample_count}],
            "columns": columns,
            "class_distributions": class_distributions
        }

class SyntheticProvider(BaseDatasetProvider):
    def download_and_extract(self, preset_key: str, storage_path: str) -> Dict[str, Any]:
        if preset_key != "synthetic-clf":
            raise ValueError(f"Unknown synthetic preset: {preset_key}")
            
        from sklearn.datasets import make_classification
        import pandas as pd
        
        X, y = make_classification(n_samples=1000, n_features=10, n_classes=2, random_state=42)
        df = pd.DataFrame(X, columns=[f"feature_{i}" for i in range(10)])
        df['target'] = y
        
        os.makedirs(storage_path, exist_ok=True)
        file_path = os.path.join(storage_path, "synthetic.csv")
        df.to_csv(file_path, index=False)
        
        sample_count = len(df)
        columns = [{"column_name": col, "dtype": str(df[col].dtype), "non_null_count": sample_count, "stat_mean": str(df[col].mean()), "stat_min": str(df[col].min()), "stat_max": str(df[col].max()), "ordinal": i} for i, col in enumerate(df.columns[:-1])]
        columns.append({"column_name": "target", "dtype": "int", "non_null_count": sample_count, "stat_mean": None, "stat_min": None, "stat_max": None, "ordinal": 10})
        
        return {
            "format": "CSV",
            "sample_count": sample_count,
            "class_count": 2,
            "feature_count": 10,
            "disk_size": f"{os.path.getsize(file_path) / 1024:.2f} KB",
            "splits": [{"split_name": "train", "sample_count": sample_count}],
            "columns": columns,
            "class_distributions": [{"class_name": "Class 0", "sample_count": 500, "ordinal": 0}, {"class_name": "Class 1", "sample_count": 500, "ordinal": 1}]
        }

class TorchvisionProvider(BaseDatasetProvider):
    def download_and_extract(self, preset_key: str, storage_path: str) -> Dict[str, Any]:
        import os
        import torchvision.datasets as datasets
        import numpy as np
        
        os.makedirs(storage_path, exist_ok=True)
        
        if preset_key == "mnist":
            train_dataset = datasets.MNIST(root=storage_path, train=True, download=True)
            test_dataset = datasets.MNIST(root=storage_path, train=False, download=True)
            feature_count = 784
        elif preset_key == "cifar10":
            train_dataset = datasets.CIFAR10(root=storage_path, train=True, download=True)
            test_dataset = datasets.CIFAR10(root=storage_path, train=False, download=True)
            feature_count = 32 * 32 * 3
        elif preset_key == "fashion_mnist":
            train_dataset = datasets.FashionMNIST(root=storage_path, train=True, download=True)
            test_dataset = datasets.FashionMNIST(root=storage_path, train=False, download=True)
            feature_count = 784
        else:
            raise ValueError(f"Unknown torchvision preset: {preset_key}")
            
        train_samples = len(train_dataset)
        test_samples = len(test_dataset)
        total_samples = train_samples + test_samples
        
        def get_dir_size(path):
            total = 0
            for dirpath, _, filenames in os.walk(path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if not os.path.islink(fp):
                        total += os.path.getsize(fp)
            return total
            
        disk_bytes = get_dir_size(storage_path)
        disk_size = f"{disk_bytes/(1024*1024):.2f} MB" if disk_bytes >= 1024*1024 else f"{disk_bytes/1024:.2f} KB"
        
        all_targets = np.concatenate([np.array(train_dataset.targets), np.array(test_dataset.targets)])
        unique, counts = np.unique(all_targets, return_counts=True)
        
        class_distributions = [
            {"class_name": str(val), "sample_count": int(count), "ordinal": i}
            for i, (val, count) in enumerate(zip(unique, counts))
        ]
        
        return {
            "format": "IDX (Binary)",
            "sample_count": total_samples,
            "class_count": len(unique),
            "feature_count": feature_count,
            "disk_size": disk_size,
            "splits": [
                {"split_name": "train", "sample_count": train_samples},
                {"split_name": "test", "sample_count": test_samples}
            ],
            "columns": [],
            "class_distributions": class_distributions
        }

class HuggingFaceProvider(BaseDatasetProvider):
    def download_and_extract(self, preset_key: str, storage_path: str) -> Dict[str, Any]:
        import datasets
        import os
        import collections
        
        os.makedirs(storage_path, exist_ok=True)
        if preset_key == "glue-sst2":
            ds = datasets.load_dataset("glue", "sst2", cache_dir=storage_path)
        elif preset_key == "imdb":
            ds = datasets.load_dataset("imdb", cache_dir=storage_path)
        elif preset_key == "ag_news":
            ds = datasets.load_dataset("ag_news", cache_dir=storage_path)
        else:
            raise ValueError(f"Unknown huggingface preset: {preset_key}")
            
        total_samples = 0
        splits = []
        
        for split_name, dataset_split in ds.items():
            split_count = len(dataset_split)
            total_samples += split_count
            splits.append({"split_name": split_name, "sample_count": split_count})
            
        def get_dir_size(path):
            total = 0
            for dirpath, _, filenames in os.walk(path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if not os.path.islink(fp):
                        total += os.path.getsize(fp)
            return total
            
        disk_bytes = get_dir_size(storage_path)
        disk_size = f"{disk_bytes/(1024*1024):.2f} MB" if disk_bytes >= 1024*1024 else f"{disk_bytes/1024:.2f} KB"
        
        columns = []
        features = ds['train'].features
        for i, (col_name, feature) in enumerate(features.items()):
            columns.append({
                "column_name": col_name,
                "dtype": feature.dtype if hasattr(feature, 'dtype') else type(feature).__name__,
                "non_null_count": total_samples,
                "stat_mean": None,
                "stat_min": None,
                "stat_max": None,
                "ordinal": i
            })
            
        class_distributions = []
        if 'label' in features and hasattr(features['label'], 'names'):
            names = features['label'].names
            counter = collections.Counter()
            for dataset_split in ds.values():
                counter.update(dataset_split['label'])
                
            for i, name in enumerate(names):
                class_distributions.append({
                    "class_name": str(name),
                    "sample_count": counter[i],
                    "ordinal": i
                })
                
        return {
            "format": "Arrow / Parquet",
            "sample_count": total_samples,
            "class_count": len(class_distributions),
            "feature_count": len(columns),
            "disk_size": disk_size,
            "splits": splits,
            "columns": columns,
            "class_distributions": class_distributions
        }

def get_provider(provider_name: str) -> BaseDatasetProvider:
    if provider_name == "sklearn":
        return SklearnProvider()
    elif provider_name == "torchvision":
        return TorchvisionProvider()
    elif provider_name == "huggingface":
        return HuggingFaceProvider()
    elif provider_name == "synthetic":
        return SyntheticProvider()
    else:
        raise ValueError(f"Unknown provider: {provider_name}")
