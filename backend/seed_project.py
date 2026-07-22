from app.schemas.project import ProjectCreate, ProjectRead
import datetime

# Test schema creation and validation
project_data = {"name": "Test Project", "description": "A secure workspace"}
p = ProjectCreate(**project_data)
print(p.model_dump()) # Expected: {'name': 'Test Project', 'description': 'A secure workspace'}

# Test ProjectRead parsing (simulating a DB fetch)
db_mock = {
    "id": "proj-123",
    "user_id": "usr-456",
    "name": "Test Project",
    "description": "A secure workspace",
    "created_at": datetime.datetime.now().isoformat(),
    "updated_at": datetime.datetime.now().isoformat(),
    "is_archived": 0,
    "members": [
        {"user_id": "usr-456", "role": "Owner", "project_id": "proj-123"}
    ]
}

parsed_proj = ProjectRead(**db_mock)
print(parsed_proj.members[0].role) # Expected: Owner
