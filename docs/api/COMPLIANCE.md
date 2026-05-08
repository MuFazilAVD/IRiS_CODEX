# IRiS — Worklist API (Shared)

## Base URL: `/iris/api/v1/worklist`
All roles can access; items are filtered by requesting user's role.

### GET `/`
Returns worklist for current user's role. Operations worklist is live from DB. Others return mock data.

See `CLAIMS.md` for full spec — same endpoint, role-aware filtering.

---

# IRiS — Compliance API

## Base URL: `/iris/api/v1/compliance`
Accessible to roles: `compliance`, `super_admin`

### GET `/sanctions/overview`
Returns compliance dashboard metrics (mock data for POC).

**Response 200:**
```json
{
  "kpis": {
    "monthly_screening_pending": 9,
    "ofac_matches": 4,
    "fincen_matches": 2,
    "false_positives_pending": 11,
    "overrides_awaiting_approval": 3,
    "high_impact_changes": 5,
    "audit_exceptions_open": 7,
    "sensitive_export_alerts": 4,
    "access_violations": 1,
    "ref_data_changes": 3,
    "compliance_holds_active": 2,
    "escalated_tasks": 4,
    "contracts_under_review": 2,
    "screening_coverage_pct": 98.7
  }
}
```

### GET `/sanctions/cedents/{cedent_id}`
Returns sanction screening status and history for a cedant. Delegates to underwriting service.

### POST `/sanctions/trigger`
Trigger bulk screening run across all active cedants.

**Request:**
```json
{ "sources": ["OFAC", "FinCEN"], "scope": "all_active" }
```

---

# IRiS — Admin API

## Base URL: `/iris/api/v1/admin`
Accessible to roles: `admin`, `super_admin`

### GET `/users`
List all users.

### POST `/users`
Create user. Delegates to auth service.

### PATCH `/users/{user_id}/role`
Change user role.

**Request:**
```json
{ "new_role": "underwriter", "reason": "Promotion approved REQ-1101" }
```

### GET `/integration-health`
Returns status of all integrations (mock for POC).

**Response 200:**
```json
{
  "endpoints": [
    { "name": "SFTP — Northstar", "status": "healthy" },
    { "name": "SFTP — Helvetia", "status": "healthy" },
    { "name": "SFTP — Atlas", "status": "degraded" },
    { "name": "Bloomberg FX Feed", "status": "healthy" },
    { "name": "CMI Mortality Sync", "status": "healthy" },
    { "name": "OFAC SDN Sync", "status": "healthy" },
    { "name": "Lovable AI Gateway", "status": "healthy" },
    { "name": "Audit Warehouse", "status": "healthy" },
    { "name": "FinCEN API", "status": "healthy" },
    { "name": "Reporting Engine", "status": "healthy" }
  ]
}
```

### GET `/pending-approvals`
Returns pending admin approval requests (mock).

---

# IRiS — Chatbot API

## Base URL: `/iris/api/v1/chatbot`

### POST `/message`
Send a message to the IRiS AI assistant.

**Request:**
```json
{
  "message": "How many active contracts do we have with Northstar?",
  "conversation_history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "user_role": "underwriter",
  "current_page": "/underwriting/contracts"
}
```

**Response 200:**
```json
{
  "response": "Northstar Pension Trust (CED-1042) has 4 active contracts...",
  "navigation_action": null,
  "sql_query_used": "SELECT COUNT(*) FROM contracts WHERE cedent_id = 'CED-1042'",
  "sources": ["contracts table", "cedents table"]
}
```

**Backend logic:**
1. Build system prompt with: user role, current page, DB schema summary, role permissions
2. Call Claude API with conversation history
3. If response contains a navigation intent, extract `navigation_action`
4. Return response to frontend

**System prompt template:**
```
You are IRiS, an intelligent assistant for MetLife's reinsurance platform.
Current user role: {role}
Current page: {page}
You have access to query the following data: contracts, cedants, settlements, worklist items, cession files, population.
You can also navigate the user to any page by including a JSON navigation action.
Always be concise and professional. Use reinsurance terminology correctly.
For navigation, output: [NAV: /path/to/page]
```
