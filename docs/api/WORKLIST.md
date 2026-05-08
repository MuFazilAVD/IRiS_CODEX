# IRiS — Worklist API (Shared)

## Base URL: `/iris/api/v1/worklist`
All roles can access. Items filtered by JWT role.

## Behaviour
- `claims_ops` → live DB query on `worklist_items` table
- All other roles → mock JSON from `mock_data/worklist_{role}.json`

## Endpoints

### GET `/`
Returns worklist items for current user's role.

**Query params:**
- `view` — `my_tasks` | `team_tasks` | `all_accessible`
- `priority` — `critical` | `high` | `medium` | `low`
- `status` — `open` | `in_progress` | `pending_review` | `resolved`
- `category` — free text filter
- `source` — `AI Agent` | `System Rule` | `Human` | `SFTP`

**Response 200:**
```json
{
  "summary": {
    "my_critical": 1,
    "overdue": 2,
    "pending_approvals": 1,
    "compliance_holds": 2,
    "ai_exception_queue": 1,
    "team_backlog": 3,
    "awaiting_review": 1
  },
  "total": 4,
  "items": [ ... ]
}
```
See `CLAIMS.md` for full worklist item schema.

### PATCH `/{wl_id}`
Update status or assign item.

**Request:**
```json
{ "status": "in_progress", "assigned_to": "uuid", "notes": "Taking ownership" }
```
