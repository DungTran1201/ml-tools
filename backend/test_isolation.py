from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_isolation():
    # 1. First get a valid project_id from the list
    print("Fetching projects to get a valid project ID...")
    response = client.get("/api/projects/")
    projects = response.json()
    assert len(projects) > 0, "No projects found. Did you run the seeder?"
    valid_project_id = projects[0]["id"]
    print(f"Valid project ID: {valid_project_id}")
    
    # 2. Test the isolation endpoint with a valid X-Project-ID header
    print("\nTesting /api/projects/isolation/test WITH valid header")
    response = client.get(
        "/api/projects/isolation/test",
        headers={"X-Project-ID": valid_project_id}
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 200, "Should succeed with valid header"
    
    # 3. Test the isolation endpoint with an invalid/fake project ID
    print("\nTesting /api/projects/isolation/test WITH invalid header")
    fake_project_id = "00000000-0000-0000-0000-000000000000"
    response = client.get(
        "/api/projects/isolation/test",
        headers={"X-Project-ID": fake_project_id}
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 403, "Should fail with 403 Forbidden"
    
    # 4. Test missing header
    print("\nTesting /api/projects/isolation/test WITHOUT header")
    response = client.get("/api/projects/isolation/test")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 422, "Should fail with 422 Unprocessable Entity (missing header)"
    
    print("\nIsolation header tests passed successfully!")

if __name__ == "__main__":
    test_isolation()
