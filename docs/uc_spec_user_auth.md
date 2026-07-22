# Use Case Specification

## 1. Use Case Name & ID
**ID:** UC-1
**Name:** User Authentication & Authorization (Module A)

## 2. Actor(s)
**Primary Actors:**
- Data Scientist / ML Engineer
- Guest User (Read-Only)

**Secondary Actors:**
- Training Engine
- Upload Pipeline

## 3. Description
This use case governs the security perimeter of the ML-Tools platform. It details how users register accounts, establish secure sessions (Log In/Out), and manage account states (Deactivation). Crucially, it defines how the backend authorization layer intercepts all incoming API requests to enforce user-level access controls across all scoped data entities (Projects, Datasets, Runs, Uploads).

## 4. Pre-conditions
- The system is online, and the SQLite3 database is accessible.
- The User Authentication UI (Login/Register screens) is reachable.
- No active session exists for the user attempting to log in or register.

## 5. Post-conditions
**Success States:**
- **Registration:** A new row is inserted into the `user` table with a securely hashed password and default `is_active = 1`.
- **Login:** The user's `last_login_at` timestamp in the `user` table is updated, and a secure session token is established.
- **Authorization:** Protected resources are successfully accessed or modified by the authenticated user.

**Failure States:**
- **Authentication Failure:** The user remains unauthenticated; no database state changes occur (401 Unauthorized).
- **Authorization Failure:** The user is denied access to resources they don't own; the transaction is aborted (403 Forbidden).

## 6. Basic Flow
**Scenario:** User Registration, Login, and Implicit Authorization Enforcement

1. **User Initiation (Registration):** The Guest User accesses the Registration UI and submits an email, display name, and password.
2. **Backend Validation & Insert:** The backend validates input, hashes the password, and executes:
   `INSERT INTO user (id, email, display_name, password_hash, is_active) VALUES (...)`.
3. **User Initiation (Login):** The Data Scientist submits credentials via the Login UI.
4. **Backend Verification:** The backend fetches `SELECT id, password_hash, is_active FROM user WHERE email = ?`. If hashes match and `is_active = 1`, authentication succeeds.
5. **State Update:** The backend updates the login timestamp: `UPDATE user SET last_login_at = ? WHERE id = ?`.
6. **Session Establishment:** The backend responds with a secure session cookie or token, transitioning the UI state to the authenticated workspace.
7. **Implicit Authorization (A4):** For all subsequent interactions (e.g., the Upload Pipeline saving a dataset or the Training Engine starting a run), the backend extracts the `user.id` from the session context and enforces it across all foreign key chains (e.g., verifying `user_id` ownership of a `project_id` before allowing the action).

## 7. Alternative Flows
**7.1. Log Out**
1. The Data Scientist clicks "Log Out" in the application header/sidebar.
2. The UI clears the local session state and redirects to the Login screen.
3. The backend invalidates the active session token (if stateful).

**7.2. Deactivate / Reactivate Account**
1. A Data Scientist (or Admin) accesses the Account Settings UI and toggles the active status.
2. The backend executes `UPDATE user SET is_active = 0 WHERE id = ?`.
3. If deactivated, all current sessions for the user are terminated, and future logins are blocked.

## 8. Exception Flows
**8.1. Invalid Login Credentials (401 Unauthorized)**
1. The user attempts to log in with an incorrect email or password.
2. The backend queries the `user` table and fails the password hash comparison.
3. The backend returns a `401 Unauthorized` error.
4. The UI displays a generic "Invalid email or password" message to prevent account enumeration.

**8.2. Account Deactivated Access Attempt (403 Forbidden)**
1. A user attempts to log in to an account where `is_active = 0`.
2. The backend successfully verifies credentials but blocks access due to the inactive flag.
3. The backend returns a `403 Forbidden` response.
4. The UI displays "Account has been deactivated. Please contact an administrator."

**8.3. Unauthenticated Access to Protected Route (401 Unauthorized)**
1. A Guest User attempts to manually navigate to a protected UI route (e.g., `/experiments`) or invoke a protected API endpoint (e.g., `POST /api/projects`).
2. The backend's authentication middleware fails to find a valid session token.
3. The backend returns a `401 Unauthorized`.
4. The UI intercepts the error and redirects the Guest User to the Login screen.
