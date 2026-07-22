from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_project_api():
    # 1. Create a project
    print("Testing POST /api/projects/")
    response = client.post("/api/projects/", json={
        "name": "Beta API Testing",
        "description": "Integration tests for the backend."
    })
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {data}")
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {data}"
    
    project_id = data["id"]
    
    # 2. List projects
    print("\nTesting GET /api/projects/")
    response = client.get("/api/projects/")
    print(f"Status: {response.status_code}")
    list_data = response.json()
    print(f"Response (count {len(list_data)}): {list_data}")
    assert response.status_code == 200
    
    # 3. Get single project
    print(f"\nTesting GET /api/projects/{project_id}")
    response = client.get(f"/api/projects/{project_id}")
    print(f"Status: {response.status_code}")
    single_data = response.json()
    print(f"Response: {single_data}")
    assert response.status_code == 200
    
    print("\nAll tests passed!")

if __name__ == "__main__":
    test_project_api()
