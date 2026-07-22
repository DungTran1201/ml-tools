# Use Case Specification

## 1. Use Case Name & ID
**ID:** UC-2
**Name:** Project Management & Multi-Project Isolation

## 2. Actor(s)
**Primary Actors:**
- Data Scientist
- Project Lead
- Admin

**Secondary Actors:**
- Authorization Service
- Database Engine (SQLite3)

## 3. Description
This use case describes the workflows for creating, switching, and archiving projects within the ML-Tools platform, as well as managing team member access (RBAC). It encompasses the Project Management UI, including creation modals and workspace switching dropdowns. Furthermore, it defines the strict multi-project data isolation boundaries, ensuring that all datasets, models, training runs, and metrics are securely scoped to the globally active `project_id`.

## 4. Pre-conditions
- The user is authenticated and possesses a valid session token.
- The system user account is active (`is_active = 1` in the `user` table).
- A default system workspace context exists, or the user is assigned to at least one active project.
- The Database Engine is online and responsive.

## 5. Post-conditions
**Success States:**
- **Project Creation:** A new project record is successfully inserted into the `project` table, and the creator is inserted into the `project_member` table with an "Admin" or "Owner" RBAC role.
- **Context Switching:** The UI global active `project_id` state is updated, triggering a refresh of all scoped views (e.g., datasets, experiments) with the new `WHERE project_id = <active_id>` filter.
- **Archiving:** The `is_archived` flag on the `project` table is set to `1`. Active training runs within the project are halted.

**Failure States:**
- **Unauthorized Access:** The state remains unchanged, and the system denies the action, returning a 403 Forbidden.
- **Constraint Violations:** Transactions are rolled back if a user attempts to archive/delete a project with active, running experiments. An error message is displayed to the user.

## 6. Basic Flow
**Scenario:** Creating a New Project and Establishing Isolation Context

1. **User Initiation:** The Data Scientist clicks the "New Project" button in the Project Management UI or top navigation bar.
2. **Modal Display:** The UI presents the Project Creation modal, prompting for `name` and `description`.
3. **Data Entry:** The Data Scientist enters the project details and clicks "Create".
4. **Backend Validation:** The backend receives the request and validates the inputs (e.g., non-empty name, name uniqueness if applicable).
5. **Database Insertion:**
   - The backend begins a transaction.
   - Inserts a new record into the `project` table: `INSERT INTO project (id, user_id, name, description, is_archived) VALUES (...)`.
   - Inserts the creator into the `project_member` table with an "Owner" role: `INSERT INTO project_member (project_id, user_id, role) VALUES (...)`.
   - Commits the transaction.
6. **Context Update:** The backend responds with the new project details (including the generated UUID).
7. **UI State Change:** The UI updates its global state, setting the active `project_id` to the newly created project's ID.
8. **View Refresh & Isolation:** The UI re-routes the user to the Project Dashboard. All subsequent API calls automatically append the active `project_id` in their payload/headers, and the backend implicitly enforces `WHERE project_id = <active_id>` in all database queries to guarantee strict multi-tenant data isolation.

## 7. Alternative Flows
**7.1. Switching the Active Project Context**
1. The user clicks the workspace switching dropdown in the top navigation bar.
2. The UI displays a list of projects the user is authorized to access (queried via `project` and `project_member` join).
3. The user selects a different project.
4. The UI updates the global active `project_id` state.
5. The UI re-fetches all scoped resources (datasets, training runs) using the new `project_id` to enforce the isolation boundary.

**7.2. Updating Project Metadata**
1. The Project Lead navigates to the Project Settings page.
2. The user edits the project's `name` or `description` and clicks "Save".
3. The backend executes an `UPDATE project SET name = ?, description = ? WHERE id = ?`.
4. The UI reflects the updated metadata.

**7.3. Managing Project Members and RBAC Roles**
1. An Admin or Project Lead navigates to the "Team & Access" tab within Project Settings.
2. The user clicks "Add Member", searches for an existing system user, and selects a role (e.g., "Viewer", "Editor", "Admin").
3. The backend executes an `INSERT INTO project_member` or `UPDATE project_member SET role = ?`.
4. The new permissions immediately dictate the member's authorization level for this specific `project_id`.

**7.4. Archiving an Inactive Project**
1. The Project Lead selects the option to archive a project from the Settings page.
2. The backend verifies there are no running tasks, then executes `UPDATE project SET is_archived = 1 WHERE id = ?`.
3. The project is removed from the active projects list in the UI dropdown.

## 8. Exception Flows
**8.1. Unauthorized Access Attempt (403 Forbidden)**
1. A user manually modifies an API request or URL to access a resource belonging to a `project_id` they are not a member of.
2. The backend Authorization Service intercepts the request.
3. The service queries the `project_member` table and finds no valid association (or insufficient RBAC role).
4. The backend aborts the operation and returns a `403 Forbidden` response.
5. The UI catches the error and displays an "Access Denied" unauthorized toast notification.

**8.2. Archiving/Deleting a Project with Active Runs**
1. The user attempts to archive or delete a project.
2. The backend checks for active dependencies (e.g., `SELECT COUNT(*) FROM training_run WHERE project_id = ? AND status = 'running'`).
3. If active runs are found, the backend blocks the operation.
4. The backend returns a `409 Conflict` or a `422 Unprocessable Entity` response.
5. The UI prevents the deletion and displays a descriptive error toast: "Cannot archive project while training runs are active. Please stop all runs first."

**8.3. Database Transaction Failure**
1. During project creation or member assignment, the SQLite3 engine encounters a lock contention or constraint violation.
2. The transaction fails to commit and is rolled back.
3. The backend returns a `500 Internal Server Error` (or `503 Service Unavailable`).
4. The UI alerts the user that the operation failed and suggests trying again later.
