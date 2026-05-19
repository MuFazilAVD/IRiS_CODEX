# IRiS — Admin API

## Base URL: `/iris/api/v1/admin`
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

### GET `/workflow-agents`
Returns the cession workflow-agent configuration register.

**Response 200:**
```json
{
  "items": [
    {
      "key": "mapping",
      "step_id": "detect-map",
      "step_label": "Detect & Map",
      "agent_name": "Mapping Agent",
      "description": "Detect the cession file type, identify the cedent, and map the treaty context.",
      "enabled": true,
      "confidence_threshold": 0.99,
      "always_pause_for_hitl": false,
      "hitl_behavior": "pause_for_approval",
      "escalation_rule": "Claims Ops review required before downstream automation continues.",
      "retry_limit": 1,
      "fallback_mode": "manual_review"
    }
  ]
}
```

### PATCH `/workflow-agents/{agent_key}`
Updates one workflow-agent configuration record.

**Request:**
```json
{
  "enabled": true,
  "confidence_threshold": 0.99,
  "always_pause_for_hitl": true,
  "hitl_behavior": "pause_for_approval",
  "escalation_rule": "Claims Ops review required before downstream automation continues.",
  "retry_limit": 1,
  "fallback_mode": "manual_review"
}
```

**Behavior:**
- `always_pause_for_hitl=false` → threshold and workflow-result logic decide whether the agent pauses for manual review
- `always_pause_for_hitl=true` → the agent always stops for HITL irrespective of threshold
