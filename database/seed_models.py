import sys
import os
import uuid
from datetime import datetime

# Add the backend root to sys.path so we can import app modules
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.append(backend_dir)

from app.core.database import SessionLocal
from app.models.model import Model, ModelTag

def seed_models():
    db = SessionLocal()
    try:
        models_to_seed = [
            {
                "slug": "sam-vit-h",
                "name": "SAM ViT-H",
                "full_name": "Segment Anything Model (ViT-H)",
                "family": "Segmentation",
                "param_count": 636000000,
                "flops": None,
                "top1_acc": None,
                "input_size": "1024x1024",
                "depth": 32,
                "source": "META AI",
                "description": "Promptable segmentation system trained on 1B masks. Generalizes to unseen objects and images.",
                "tags": ["segmentation", "zero-shot", "foundation"]
            },
            {
                "slug": "xgboost",
                "name": "XGBoost",
                "full_name": "Extreme Gradient Boosting",
                "family": "Classical",
                "param_count": 500,
                "flops": None,
                "top1_acc": None,
                "input_size": "Tabular",
                "depth": None,
                "source": "DMLC",
                "description": "Gradient boosted decision trees with regularization. Dominant algorithm on many Kaggle tabular competitions.",
                "tags": ["classification", "boosting", "regression"]
            },
            {
                "slug": "clip-vit-b32",
                "name": "CLIP ViT-B/32",
                "full_name": "Contrastive Language-Image Pre-Training",
                "family": "Multimodal",
                "param_count": 151000000,
                "flops": 12700000000,
                "top1_acc": 63.4,
                "input_size": "224x224",
                "depth": 12,
                "source": "OPENAI",
                "description": "Contrastive language-image pretraining. Zero-shot classification via text prompts.",
                "tags": ["multimodal", "contrastive", "zero-shot"]
            },
            {
                "slug": "yolov8-l",
                "name": "YOLOv8-L",
                "full_name": "You Only Look Once v8 Large",
                "family": "Detection",
                "param_count": 43000000,
                "flops": 165000000000,
                "top1_acc": None,
                "input_size": "640x640",
                "depth": None,
                "source": "ULTRALYTICS",
                "description": "Real-time object detector with anchor-free head. 53.0 mAP on COCO with fast inference.",
                "tags": ["detection", "anchor-free", "real-time"]
            },
            {
                "slug": "random-forest",
                "name": "Random Forest",
                "full_name": "Random Forest Classifier",
                "family": "Classical",
                "param_count": 100,
                "flops": None,
                "top1_acc": None,
                "input_size": "Tabular",
                "depth": None,
                "source": "SCIKIT-LEARN",
                "description": "Bagged ensemble of decorrelated decision trees. Robust to overfitting and handles non-linear relationships.",
                "tags": ["classification", "ensemble", "regression"]
            },
            {
                "slug": "resnet-50",
                "name": "ResNet-50",
                "full_name": "Residual Networks 50",
                "family": "CNN",
                "param_count": 25000000,
                "flops": 4180000000,
                "top1_acc": 76.1,
                "input_size": "224x224",
                "depth": 50,
                "source": "MICROSOFT",
                "description": "Canonical residual network with skip connections. Industry baseline for image classification.",
                "tags": ["classification", "pretrained", "baseline"]
            },
            {
                "slug": "kmeans",
                "name": "K-Means",
                "full_name": "K-Means Clustering",
                "family": "Classical",
                "param_count": 8,
                "flops": None,
                "top1_acc": None,
                "input_size": "Tabular",
                "depth": None,
                "source": "SCIKIT-LEARN",
                "description": "Centroid-based partitioning into k clusters via iterative EM. Fast and scalable for large datasets.",
                "tags": ["clustering", "centroid", "unsupervised"]
            },
            {
                "slug": "log-regression",
                "name": "Log. Regression",
                "full_name": "Logistic Regression",
                "family": "Classical",
                "param_count": 1,
                "flops": None,
                "top1_acc": None,
                "input_size": "Tabular",
                "depth": None,
                "source": "SCIKIT-LEARN",
                "description": "Linear model with sigmoid/softmax output for classification. Highly interpretable baseline.",
                "tags": ["classification", "regression"]
            },
            {
                "slug": "u-net",
                "name": "U-Net",
                "full_name": "U-Net Convolutional Network",
                "family": "Segmentation",
                "param_count": 31000000,
                "flops": 54600000000,
                "top1_acc": None,
                "input_size": "572x572",
                "depth": 23,
                "source": "FREIBURG",
                "description": "Encoder-decoder with skip connections for biomedical image segmentation.",
                "tags": ["segmentation", "medical"]
            },
            {
                "slug": "vit-l-16",
                "name": "ViT-L/16",
                "full_name": "Vision Transformer Large",
                "family": "Transformer",
                "param_count": 307000000,
                "flops": 61000000000,
                "top1_acc": 87.8,
                "input_size": "224x224",
                "depth": 24,
                "source": "GOOGLE",
                "description": "Large-scale vision transformer treating images as sequences of patches.",
                "tags": ["classification", "attention"]
            },
            {
                "slug": "swin-l",
                "name": "Swin-L",
                "full_name": "Swin Transformer Large",
                "family": "Transformer",
                "param_count": 197000000,
                "flops": 34500000000,
                "top1_acc": 87.3,
                "input_size": "224x224",
                "depth": 24,
                "source": "MICROSOFT",
                "description": "Hierarchical vision transformer with shifted windows. Versatile backbone.",
                "tags": ["classification", "detection"]
            },
            {
                "slug": "knn",
                "name": "KNN",
                "full_name": "K-Nearest Neighbors",
                "family": "Classical",
                "param_count": 1,
                "flops": None,
                "top1_acc": None,
                "input_size": "Tabular",
                "depth": None,
                "source": "SCIKIT-LEARN",
                "description": "Instance-based learner classifying by majority vote of k nearest neighbors.",
                "tags": ["classification", "regression"]
            },
            {
                "slug": "mobilenet-v3-l",
                "name": "MobileNetV3-L",
                "full_name": "MobileNet Version 3 Large",
                "family": "Lightweight",
                "param_count": 5400000,
                "flops": 220000000,
                "top1_acc": 75.2,
                "input_size": "224x224",
                "depth": None,
                "source": "GOOGLE",
                "description": "Hardware-aware NAS optimized for mobile and edge. Inverted residuals.",
                "tags": ["lightweight", "mobile", "edge"]
            },
            {
                "slug": "efficientnet-b4",
                "name": "EfficientNet-B4",
                "full_name": "EfficientNet B4",
                "family": "CNN",
                "param_count": 19000000,
                "flops": 4200000000,
                "top1_acc": 83.0,
                "input_size": "380x380",
                "depth": None,
                "source": "GOOGLE",
                "description": "Compound-scaled CNN balancing width, depth, and resolution.",
                "tags": ["classification", "pretrained"]
            },
            {
                "slug": "convnext-xl",
                "name": "ConvNeXt-XL",
                "full_name": "ConvNeXt Extra Large",
                "family": "CNN",
                "param_count": 350000000,
                "flops": 68900000000,
                "top1_acc": 87.8,
                "input_size": "224x224",
                "depth": None,
                "source": "META AI",
                "description": "Modernized CNN design inspired by transformers. Matches ViT.",
                "tags": ["classification", "pretrained", "modern-cnn"]
            },
            {
                "slug": "densenet-201",
                "name": "DenseNet-201",
                "full_name": "Dense Convolutional Network 201",
                "family": "CNN",
                "param_count": 20000000,
                "flops": 4300000000,
                "top1_acc": 77.3,
                "input_size": "224x224",
                "depth": 201,
                "source": "CORNELL",
                "description": "Dense connectivity where each layer receives feature maps from all preceding layers.",
                "tags": ["classification", "dense-connections", "pretrained"]
            },
            {
                "slug": "deit-b",
                "name": "DeiT-B",
                "full_name": "Data-efficient Image Transformers Base",
                "family": "Transformer",
                "param_count": 86000000,
                "flops": 17600000000,
                "top1_acc": 83.4,
                "input_size": "224x224",
                "depth": 12,
                "source": "META AI",
                "description": "Transformer trained without extra data via distillation token. Pure ImageNet.",
                "tags": ["classification", "efficient", "distillation"]
            }
        ]

        for data in models_to_seed:
            model = db.query(Model).filter(Model.slug == data["slug"]).first()
            if not model:
                model_id = str(uuid.uuid4())
                now = datetime.utcnow().isoformat()
                
                db_model = Model(
                    id=model_id,
                    slug=data["slug"],
                    name=data["name"],
                    full_name=data["full_name"],
                    family=data["family"],
                    param_count=data["param_count"],
                    flops=data["flops"],
                    top1_acc=data["top1_acc"],
                    input_size=data["input_size"],
                    depth=data["depth"],
                    source=data["source"],
                    description=data["description"],
                    is_public=1,
                    fork_count=0,
                    created_at=now,
                    updated_at=now
                )
                db.add(db_model)
                
                # Tags
                for tag_str in data["tags"]:
                    db.add(ModelTag(
                        id=str(uuid.uuid4()),
                        model_id=model_id,
                        tag=tag_str
                    ))
                
                db.commit()
                print(f"Created model: {data['name']}")
            else:
                print(f"Model already exists: {data['name']}")

    finally:
        db.close()

if __name__ == "__main__":
    seed_models()
