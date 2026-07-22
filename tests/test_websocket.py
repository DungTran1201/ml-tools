import asyncio
from fastapi.testclient import TestClient
from main import app
from app.services.mock_engine import advance_running_trainings
from test_launch import test_launch_api, get_seeded_ids

def test_websocket_broadcast():
    client = TestClient(app)
    
    # 1. Start a training run
    print("Launching run...")
    try:
        test_launch_api()
    except Exception:
        pass
        
    project_id, _, _, _ = get_seeded_ids()
    
    # 2. Connect to the WebSocket
    print(f"Connecting to WS for project: {project_id}")
    with client.websocket_connect(f"/api/training/ws/{project_id}") as websocket:
        
        # 3. Trigger the engine manually (since background task might not run smoothly in TestClient)
        # We need to run the async function in a sync context
        print("Manually triggering mock engine...")
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        loop.run_until_complete(advance_running_trainings())
        
        # 4. Receive the broadcasted message
        print("Waiting for websocket message...")
        data = websocket.receive_json()
        print(f"Received WS Message: {data}")
        
        assert data["event"] == "run_update"
        assert data["project_id"] == project_id
        assert "train_loss" in data
        assert "latest_log" in data
        
        print("\nWebSocket broadcast test passed successfully!")

if __name__ == "__main__":
    test_websocket_broadcast()
