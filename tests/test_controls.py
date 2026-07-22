import sqlite3
from fastapi.testclient import TestClient
from main import app
from test_launch import test_launch_api, get_seeded_ids
from app.models.training import TrainingRun
from app.core.database import SessionLocal

def get_latest_run_id():
    conn = sqlite3.connect("../database/app.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM training_run ORDER BY created_at DESC LIMIT 1")
    run_id = cursor.fetchone()[0]
    conn.close()
    return run_id

def test_controls_api():
    client = TestClient(app)
    
    # 1. Start a training run
    print("Launching run...")
    try:
        test_launch_api()
    except Exception:
        pass
        
    project_id, _, _, _ = get_seeded_ids()
    run_id = get_latest_run_id()
    
    print(f"Testing controls on Run ID: {run_id}")
    
    # 2. Try to Pause
    print("\nTesting POST /api/training/{run_id}/pause")
    res_pause = client.post(f"/api/training/{run_id}/pause", headers={"X-Project-ID": project_id})
    print(f"Status: {res_pause.status_code}")
    if res_pause.status_code != 200:
        print(res_pause.json())
    assert res_pause.status_code == 200
    assert res_pause.json()["status"] == "paused"
    
    # 3. Try to Pause again (should fail because it's not 'running')
    res_pause_again = client.post(f"/api/training/{run_id}/pause", headers={"X-Project-ID": project_id})
    assert res_pause_again.status_code == 400
    print("Successfully blocked second pause.")
    
    # 4. Try to Resume
    print("\nTesting POST /api/training/{run_id}/resume")
    res_resume = client.post(f"/api/training/{run_id}/resume", headers={"X-Project-ID": project_id})
    print(f"Status: {res_resume.status_code}")
    assert res_resume.status_code == 200
    assert res_resume.json()["status"] == "running"
    
    # 5. Try to Stop
    print("\nTesting POST /api/training/{run_id}/stop")
    res_stop = client.post(f"/api/training/{run_id}/stop", headers={"X-Project-ID": project_id})
    print(f"Status: {res_stop.status_code}")
    assert res_stop.status_code == 200
    assert res_stop.json()["status"] == "stopped"
    
    # Verify in DB
    db = SessionLocal()
    run = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
    assert run.status == "stopped"
    assert run.finished_at is not None
    
    db.close()
    
    print("\nAll Run Controls tests passed successfully!")

if __name__ == "__main__":
    test_controls_api()
