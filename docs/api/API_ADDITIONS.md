# IRiS — API Additions & Updates
## New APIs: Compliance, Audit, Reports, Admin, Reference Library

---

# COMPLIANCE API — UPDATED
## Base URL: `/iris/api/v1/compliance`

### GET `/sanctions/screen`
Run screening for a single entity using the 2-step flow (keyword → LLM).

**Request:**
```json
{
  "entity_name": "Hans Müller",
  "dob": "1962-03-15",
  "cedent_id": "CED-1201",
  "member_id": "ZUR-8801",
  "trigger_type": "pipeline",
  "cession_file_id": "uuid"
}
```

**Response 200:**
```json
{
  "screening_ref": "SHM-891",
  "entity_name": "Hans Müller",
  "result": "review",
  "matched_lists": ["OFAC SDN"],
  "llm_called": true,
  "llm_confidence": 0.92,
  "llm_reasoning": "Name, DOB and country match exceeds threshold 0.85. Recommend human review.",
  "method": "llm_confirmed"
}
```

**Backend logic:**
```python
async def screen_entity(entity_name, dob=None, ...):
    # Step 1: keyword match against screening_cache_lists table
    matches = await keyword_fuzzy_match(entity_name, threshold=0.75)
    
    if not matches:
        return {"result": "cleared", "method": "keyword_no_match", "llm_called": False}
    
    # Step 2: LLM verification
    prompt = f"""
    Potential sanctions match found.
    Entity: {entity_name} (DOB: {dob})
    Matched against: {[m['list_name'] for m in matches]}
    Match details: {matches}
    
    Determine if this is a genuine sanctions match or false positive.
    Return JSON only: {{"is_genuine_match": bool, "confidence": float, "reasoning": str}}
    """
    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500
    )
    llm_result = json.loads(response.content[0].text)
    
    if not llm_result["is_genuine_match"]:
        result = "cleared"
        method = "llm_false_positive"
    else:
        result = "review"
        method = "llm_confirmed"
    
    # Save to screening_events table
    await db.save_screening_event(...)
    return {"result": result, "llm_confidence": llm_result["confidence"], ...}
```

---

### POST `/sanctions/bulk-screen`
Screen all active cedants and members. Queued background job.

**Request:**
```json
{ "scope": "all_active", "sources": ["OFAC SDN", "FinCEN 314(a)"] }
```

**Response 202:**
```json
{ "job_id": "uuid", "status": "queued", "estimated_duration_seconds": 120 }
```

---

### GET `/sanctions/hits`
Returns all active screening hits (result = 'review' or 'escalated').

**Response 200:**
```json
{
  "total": 3,
  "items": [
    {
      "screening_ref": "SHM-887",
      "entity_name": "Sergei V. Markov",
      "match_type": "OFAC",
      "source": "OFAC DB",
      "confidence": 0.88,
      "result": "escalated",
      "cedent": "Northstar Pension Trust",
      "member_id": "PEN-0100234"
    }
  ]
}
```

---

### PATCH `/sanctions/hits/{screening_ref}`
Resolve a screening hit.

**Request:**
```json
{
  "action": "clear",           // "clear" | "escalate" | "mark_false_positive"
  "notes": "Confirmed different individual after document review"
}
```

---

# AUDIT & TRACEABILITY API
## Base URL: `/iris/api/v1/audit`

### GET `/dashboard`
Returns audit dashboard KPIs and today's timeline.

**Response 200:**
```json
{
  "kpis": {
    "audit_events_today": 10,
    "pct_change_vs_7d": 23,
    "high_risk_changes": 7,
    "high_risk_critical": 2,
    "pending_approvals": 3,
    "oldest_pending_hours": 3,
    "manual_overrides": 1,
    "ai_decisions_pending_review": 1,
    "ai_below_confidence": 1,
    "failed_screenings": 0,
    "high_financial_impact": 4
  },
  "timeline": [
    {
      "timestamp": "2026-04-29T11:11:42Z",
      "module": "settlement",
      "event_type": "Settlement Approved",
      "actor_type": "human",
      "actor_id": "d.rhodes@reinsure.io",
      "entity_id": "STL-2026-Q1-184",
      "description": "Approved Q1 settlement after reconciliation review",
      "financial_impact_amount": 4210000,
      "financial_impact_currency": "GBP",
      "is_high_impact": true,
      "approval_status": "approved"
    }
  ],
  "high_impact_changes": [...],
  "ai_pending_review": [...]
}
```

---

### GET `/search`
Advanced audit log search.

**Query params:**
- `q` — text search
- `module` — filter by module
- `actor` — human | ai | system
- `approval` — pending | approved | rejected | n/a
- `impact` — high | any
- `risk` — all | high | critical
- `from_date`, `to_date`
- `page`, `page_size`

**Response 200:**
```json
{
  "total": 15,
  "items": [
    {
      "audit_id": "AUD-2026-04-29-001",
      "timestamp": "2026-04-29T11:11:42Z",
      "module": "settlement",
      "event_type": "Settlement Approved",
      "actor_type": "human",
      "actor_id": "d.rhodes@reinsure.io",
      "entity_id": "STL-2026-Q1-184",
      "description": "Approved Q1 settlement after reconciliation review"
    }
  ]
}
```

---

### GET `/financial-impact`
Returns events with financial impact, filtered.

### GET `/approvals`
Returns approval audit trail.

### GET `/ai-decisions`
Returns AI decision log with explainability entries.

**Response 200:**
```json
{
  "kpis": {
    "ai_decisions_logged": 3,
    "below_confidence_floor": 1,
    "human_overrides": 0
  },
  "decisions": [
    {
      "agent_name": "Cession Mapper v3.2.1",
      "agent_version": "3.2.1",
      "module": "Cession",
      "confidence": 0.81,
      "below_threshold": true,
      "decision": "Map 'Pensioner_Ref' → member_id; flag 'Annuity_Type_Code' & 'Spouse_Indicator' for human confirmation",
      "prompt_summary": "Map columns of incoming cession file to canonical schema...",
      "input_ref": "sftp://atlas/in/CES-2026-04-118.xlsx",
      "human_review_required": true,
      "timestamp": "2026-04-29T10:48:09Z"
    }
  ]
}
```

---

### GET `/manual-overrides`
Returns all manual overrides.

**Response 200:**
```json
{
  "total": 1,
  "overrides": [
    {
      "override_ref": "CALC-2026-Q1-918",
      "module": "calculation",
      "field_name": "mortality_improvement_factor",
      "original_value": "1.25",
      "override_value": "1.18",
      "reason": "CMI 2024 release expected within 7d; using interim calibrated value.",
      "financial_impact_amount": -3180000,
      "financial_impact_currency": "GBP",
      "approver_role": "compliance",
      "approver_title": "Chief Actuary",
      "approved_at": "2026-04-29T10:22:55Z"
    }
  ]
}
```

---

### GET `/reference-data`
Returns reference data change audit trail.

### GET `/access-logs`
Returns access event log.

### GET `/document-history`
Returns document-level event history.

### GET `/export-reports`
Returns list of downloadable audit reports (static for POC).

**Response 200:**
```json
{
  "reports": [
    { "name": "Audit Report", "description": "Full audit log with filters applied.", "formats": ["csv","json"] },
    { "name": "Regulatory Review Report", "description": "Quarterly review pack for PRA / EIOPA / NAIC.", "formats": ["csv","json"] },
    { "name": "Compliance Report", "description": "Sanctions screenings, hits, escalations & sign-offs.", "formats": ["csv","json"] },
    { "name": "Override Exception Report", "description": "All manual overrides with reasons & approvers.", "formats": ["csv","json"] },
    { "name": "AI Governance Report", "description": "AI decisions, confidence & override rates.", "formats": ["csv","json"] },
    { "name": "Financial Impact Report", "description": "All events with financial impact, signed and netted.", "formats": ["csv","json"] }
  ]
}
```

### GET `/export-reports/download`
Returns a mock CSV/JSON file download (pre-generated static file for POC).

**Query params:** `report_name`, `format` (csv|json)

---

# REPORTS API
## Base URL: `/iris/api/v1/reports`

### GET `/`
Returns all reports filtered by user's role.

**Query params:** `category`, `cedent_id`, `contract_id`, `period`, `sensitivity`

**Response 200:**
```json
{
  "total": 23,
  "categories": ["Historical","Dynamic","Movement","Compliance","Financial","Admin"],
  "items": [
    {
      "report_id": "RPT-H-001",
      "name": "Settlement Calculation Report",
      "description": "...",
      "category": "Historical",
      "cadence": "Quarterly",
      "distribution": ["Claims Ops","Finance","Cedant Relationship"],
      "sensitivity": "Sensitive",
      "is_accessible": true
    }
  ]
}
```

---

### GET `/{report_id}`
Returns mock report data for a specific report.

**Response 200:** Returns the hardcoded mock table/chart data for that report type.

---

### POST `/export`
Mock export — returns a pre-generated static file.

**Request:**
```json
{ "report_ids": ["RPT-H-001","RPT-H-002"], "format": "excel", "filters": {} }
```

---

# ADMIN API — UPDATED
## Base URL: `/iris/api/v1/admin`

### GET `/users`
**Response 200:**
```json
{
  "total": 6,
  "users": [
    {
      "id": "uuid",
      "full_name": "Mia Patel",
      "email": "m.patel@reinsure.io",
      "role": "underwriter",
      "status": "active",
      "last_login": "2025-04-29T08:42:00Z"
    }
  ]
}
```

---

### POST `/users`
Create user. Returns generated password.

**Request:**
```json
{
  "full_name": "New User",
  "email": "new@reinsure.io",
  "role": "claims_ops"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "email": "new@reinsure.io",
  "role": "claims_ops",
  "status": "invited",
  "temp_password": "iris_Xk9mP2qW"
}
```

---

### PATCH `/users/{user_id}`
Update user role or status.

**Request:**
```json
{ "role": "compliance", "status": "active" }
```

---

### DELETE `/users/{user_id}`
Revoke user (sets status=suspended, creates audit log).

---

### GET `/library`
Returns all reference data items by type.

**Query params:** `type` (mortality_table|yield_curve|fx_rate|assumption_set|file_template|screening_cache)

---

### GET `/library/{ref_id}`
Returns a single reference data item with its data payload.

---

### POST `/library`
Upload new reference data version.

**Request:** `multipart/form-data` with `data_type`, `source`, `effective_date`, `file`, `notes`

---

### POST `/library/screening-cache/{list_name}/sync`
Force sync a screening list (mock — updates `last_sync` timestamp only in POC).

---

### GET `/permissions`
Returns the module permissions matrix (hardcoded for POC).

---

### GET `/approval-matrix`
Returns the approval thresholds table (hardcoded for POC).

---

# PIPELINE API — UPDATED (New V2 Format)
## Base URL: `/iris/api/v1/operations`

The Operations pipeline now follows the new 6-step structure (from screenshots):
**Normalization → Calculations → Variance Analysis → Screening → AI Decision → Outcome**

### GET `/pipelines`
Returns active pipelines list.

**Response 200:**
```json
{
  "active_pipelines": [
    {
      "process_id": "IRIS-PRC-59206-A",
      "filename": "ZUR_MOVEMENT_Q1.csv",
      "cedent": "Zurich Assurance",
      "received_at": "2024-04-24T10:05:00Z",
      "priority": "Medium",
      "current_step": "Normalization",
      "pipeline_health": "Optimal"
    },
    {
      "process_id": "IRIS-PRC-59200-A",
      "filename": "Phoenix_Q1_2026_ML.csv",
      "cedent": "Phoenix Re",
      "received_at": "2024-04-23T09:42:00Z",
      "priority": "High",
      "current_step": "Variance Analysis",
      "pipeline_health": "Optimal"
    }
  ]
}
```

---

### GET `/pipelines/{process_id}`
Returns full pipeline state for one file.

---

### GET `/pipelines/{process_id}/normalization`
Returns normalization step data: input preview, column mapping, rules, validation, normalized output.

**Response (tab=validation):**
```json
{
  "total_fields": 9,
  "fields_with_issues": 2,
  "fields_corrected": 1,
  "fields_inferred": 2,
  "field_validations": [
    {
      "field_name": "DOB",
      "checked": 15240,
      "issues": 120,
      "corrected": 120,
      "inferred": 0,
      "status": "Fixed",
      "method_used": "Statistical Imputation"
    },
    {
      "field_name": "Spouse Flag",
      "checked": 15240,
      "issues": 5,
      "corrected": 0,
      "inferred": 5,
      "status": "Inferred",
      "method_used": "Rule-Based Logic"
    }
  ],
  "risk_indicators": {
    "imputed_count": 120,
    "inferred_count": 5,
    "confidence": 0.994,
    "risk_level": "Moderate"
  }
}
```

---

### GET `/pipelines/{process_id}/calculations`
Returns actuarial engine results (same as `/iris/api/v1/claims/calculations/run` response).

---

### GET `/pipelines/{process_id}/variance`
Returns deviation review data.

---

### GET `/pipelines/{process_id}/screening`
Returns compliance & AML screening results for this pipeline.

---

### GET `/pipelines/{process_id}/ai-decision`
Returns AI agent recommendation for this pipeline.

---

### GET `/pipelines/{process_id}/outcome`
Returns workflow finalization state.

---

### POST `/pipelines/{process_id}/advance`
Advance pipeline to next step.

**Request:**
```json
{
  "current_step": "normalization",
  "action": "approve",
  "notes": "Imputation accepted"
}
```

---

### POST `/pipelines/{process_id}/abort`
Abort a pipeline. Creates audit log.

---

### POST `/pipelines/{process_id}/screening/resolve`
Resolve a screening hit within a pipeline.

**Request:**
```json
{
  "screening_ref": "SHM-887",
  "action": "escalate_to_compliance",
  "notes": "High confidence OFAC match — routing to compliance team"
}
```
