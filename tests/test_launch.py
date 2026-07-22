from fastapi.testclient import TestClient
from main import app
import sqlite3

client = TestClient(app)

def get_seeded_ids():
    conn = sqlite3.connect("../database/app.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM project LIMIT 1")
    project_id = cursor.fetchone()[0]
    
    cursor.execute("SELECT id FROM dataset LIMIT 1")
    dataset_id = cursor.fetchone()[0]
    
    cursor.execute("SELECT id FROM model LIMIT 1")
    model_id = cursor.fetchone()[0]
    
    cursor.execute("SELECT id FROM hardware_config LIMIT 1")
    hw_config_id = cursor.fetchone()[0]
    
    conn.close()
    return project_id, dataset_id, model_id, hw_config_id

def test_launch_api():
    project_id, dataset_id, model_id, hw_config_id = get_seeded_ids()
    print(f"Using Project: {project_id}")
    print(f"Using Dataset: {dataset_id}")
    print(f"Using Model: {model_id}")
    print(f"Using Hardware: {hw_config_id}")
    
    payload = {
        "name": "My ResNet Run",
        "project_id": project_id,
        "dataset_id": dataset_id,
        "base_model_id": model_id,
        "hardware_config_id": hw_config_id,
        "hyperparameters": {
            "learning_rate": "1e-4",
            "batch_size": "32",
            "optimizer": "Adam",
            "epochs": "50",
            "scheduler": "CosineAnnealingLR",
            "extra": {"label_smoothing": 0.1}
        }
    }
    
    print("\nTesting POST /api/training/launch")
    response = client.post(
        "/api/training/launch", 
        json=payload,
        headers={"X-Project-ID": project_id}
    )
    
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {data}")
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {data}"
    
    assert data["status"] == "running"
    assert data["name"] == "My ResNet Run"
    assert data["epochs_total"] == 50
    assert "run_id" in data
    
    # Check that another run cannot be launched (PRE-7)
    print("\nTesting PRE-7: Single run constraint")
    response2 = client.post(
        "/api/training/launch", 
        json=payload,
        headers={"X-Project-ID": project_id}
    )
    print(f"Status (2nd run): {response2.status_code}")
    print(f"Response: {response2.json()}")
    assert response2.status_code == 409, "Should fail with 409 Conflict due to existing running run"
    
    # Check missing X-Project-ID header
    print("\nTesting Missing Header")
    response3 = client.post("/api/training/launch", json=payload)
    print(f"Status (no header): {response3.status_code}")
    assert response3.status_code == 422
    
    # Check mismatched project ID
    print("\nTesting Mismatched Project ID")
    payload_mismatch = dict(payload)
    payload_mismatch["project_id"] = "fake-project-id"
    response4 = client.post(
        "/api/training/launch", 
        json=payload_mismatch,
        headers={"X-Project-ID": project_id}
    )
    print(f"Status (mismatch): {response4.status_code}")
    assert response4.status_code == 400
    
    print("\nAll Training Launch tests passed!")

if __name__ == "__main__":
    test_launch_api()
