import sqlite3
from fastapi.testclient import TestClient
from main import app
from test_launch import test_launch_api, get_seeded_ids

def get_latest_run_id():
    conn = sqlite3.connect("../database/app.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM training_run ORDER BY created_at DESC LIMIT 1")
    run_id = cursor.fetchone()[0]
    conn.close()
    return run_id

def test_step10():
    client = TestClient(app)
    
    # 1. Start a training run
    print("Launching run...")
    try:
        test_launch_api()
    except Exception:
        pass
        
    project_id, _, _, _ = get_seeded_ids()
    run_id = get_latest_run_id()
    
    # 2. Test Hyperparameter Update
    print("\nTesting POST /api/training/{run_id}/hyperparameters")
    payload = {
        "learning_rate": "1e-5",
        "epochs": "100",
        "extra": {"new_key": "new_value"}
    }
    res_hp = client.post(
        f"/api/training/{run_id}/hyperparameters",
        json=payload,
        headers={"X-Project-ID": project_id}
    )
    print(f"Status: {res_hp.status_code}")
    if res_hp.status_code != 200:
        print(res_hp.json())
    assert res_hp.status_code == 200
    assert res_hp.json()["version"] == 2
    
    # Check if DB has version 2
    conn = sqlite3.connect("../database/app.db")
    cursor = conn.cursor()
    cursor.execute("SELECT version, learning_rate FROM hyperparameter_config WHERE run_id=? ORDER BY version DESC LIMIT 1", (run_id,))
    row = cursor.fetchone()
    assert row[0] == 2
    assert row[1] == "1e-5"
    conn.close()
    
    # 3. Test Project Archiving Constraints
    print("\nTesting POST /api/projects/{project_id}/archive")
    res_arch = client.post(
        f"/api/projects/{project_id}/archive",
        # Test client auth logic (mock user has id = 1)
        # Using default dependency
    )
    print(f"Archive Status: {res_arch.status_code}")
    assert res_arch.status_code == 200
    
    # 4. Try to interact with the run (e.g. pause it) in an archived project
    print("\nTesting control on archived project (should fail with 403)")
    res_fail = client.post(
        f"/api/training/{run_id}/pause",
        headers={"X-Project-ID": project_id}
    )
    print(f"Fail Status: {res_fail.status_code}")
    assert res_fail.status_code == 403
    print("Successfully blocked by archiving constraint.")
    
    print("\nStep 10 tests passed successfully!")

if __name__ == "__main__":
    test_step10()
