# IRiS — Admin API

## Base URL: `/api/v1/admin`
Accessible to roles: `admin`, `super_admin`

> Most Admin module features are out of scope for POC. Endpoints return mock data.

### GET `/users`
Returns all users. Mock for POC.

### POST `/users`
Create user. Delegates to auth service.

### PATCH `/users/{user_id}/role`
Change user role.

**Request:**
```json
{ "new_role": "underwriter", "reason": "Promotion approved REQ-1101" }
```

### GET `/integration-health`
Returns mock integration health status for all 10 endpoints.
See `mock-data/MOCK_DATA.md` → `integration_health.json`

### GET `/pending-approvals`
Returns mock pending approval requests.
See `mock-data/MOCK_DATA.md` → `pending_approvals.json`

### GET `/audit-log`
Returns platform-wide audit log (mock).
