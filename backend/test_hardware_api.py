import requests
import websockets
import asyncio
import json

API_URL = "http://127.0.0.1:8000/api/hardware"
WS_URL = "ws://127.0.0.1:8000/api/hardware/ws"

def test_rest_api():
    print("--- Testing REST API ---")
    
    print("1. Fetching config...")
    resp = requests.get(f"{API_URL}/config")
    if resp.status_code == 200:
        print(f"Success! Config: {resp.json()}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

    print("\n2. Fetching latest metrics (Idle)...")
    resp = requests.get(f"{API_URL}/metrics/latest")
    if resp.status_code == 200:
        metrics = resp.json()
        print(f"Success! Retrieved {len(metrics)} latest metrics. Latest metric snippet:")
        if metrics:
            print(metrics[-1])
    else:
        print(f"Error {resp.status_code}: {resp.text}")

    print("\n3. Fetching historical metrics (Mock Run ID, Epoch 1)...")
    # This might return empty if no runs have reached epoch 1 yet, but we test the endpoint's validity.
    resp = requests.get(f"{API_URL}/metrics/history?run_id=mock_run_123&epoch=1")
    if resp.status_code == 200:
        hist_metrics = resp.json()
        print(f"Success! Retrieved {len(hist_metrics)} historical metrics for Epoch 1.")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

async def test_websocket():
    print("\n--- Testing WebSocket Streaming ---")
    print(f"Connecting to {WS_URL} ...")
    try:
        async with websockets.connect(WS_URL) as ws:
            print("Connected. Waiting for the first hardware tick (max 2 seconds)...")
            msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
            data = json.loads(msg)
            print(f"Received WS Message! Event: {data.get('event')}, metrics count: {len(data.get('metrics', []))}")
            if data.get('metrics'):
                print("First metric sample:")
                print(data['metrics'][0])
    except asyncio.TimeoutError:
        print("Timeout! Did not receive WS message within 2 seconds.")
    except Exception as e:
        print(f"WebSocket error: {e}")

if __name__ == "__main__":
    test_rest_api()
    asyncio.run(test_websocket())
