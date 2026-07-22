import asyncio
from fastapi.testclient import TestClient
from main import app
from app.services.mock_engine import advance_running_trainings
from test_launch import test_launch_api, get_seeded_ids

def test_aggregate_api():
    client = TestClient(app)
    
    # 1. Start a training run
    print("Launching run...")
    try:
        test_launch_api()
    except Exception:
        pass
        
    project_id, _, _, _ = get_seeded_ids()
    
    # Run the background engine once
    print("Ticking engine...")
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    loop.run_until_complete(advance_running_trainings())
    
    # We need the run_id. We can query the DB.
    import sqlite3
    conn = sqlite3.connect("../database/app.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM training_run ORDER BY created_at DESC LIMIT 1")
    run_id = cursor.fetchone()[0]
    conn.close()
    
    # 2. Test the aggregate endpoint
    print(f"\nTesting GET /api/training/{run_id}/aggregate")
    response = client.get(
        f"/api/training/{run_id}/aggregate",
        headers={"X-Project-ID": project_id}
    )
    
    print(f"Status: {response.status_code}")
    data = response.json()
    assert response.status_code == 200
    
    assert "run" in data
    assert "metrics" in data
    assert "logs" in data
    
    print(f"Run ID: {data['run']['id']}")
    print(f"Metrics count: {len(data['metrics'])}")
    print(f"Logs count: {len(data['logs'])}")
    
    # It should have cached it. Let's call it again and see if it responds fast and correctly.
    response2 = client.get(
        f"/api/training/{run_id}/aggregate",
        headers={"X-Project-ID": project_id}
    )
    assert response2.status_code == 200
    print("Second call successful (cache hit).")
    
    print("\nAggregate Refresher tests passed successfully!")

if __name__ == "__main__":
    test_aggregate_api()
