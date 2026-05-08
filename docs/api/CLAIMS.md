# IRiS — Claims & Settlement API

## Base URL: `/iris/api/v1/claims`
Accessible to roles: `claims_ops`, `super_admin`

---

## CESSION FILES

### GET `/cession-files`
Returns file queue with metrics.

**Query params:** `status` (all|exceptions|review|approved), `file_type`, `cedent_id`, `page`, `page_size`

**Response 200:**
```json
{
  "metrics": {
    "in_pipeline": 6,
    "exceptions": 4,
    "processed": 2,
    "stp_pct": 94.2,
    "pipeline_throughput": {
      "records_ingested": 18976,
      "files": 7,
      "in_exception": 4,
      "avg_processing_time": "2h 14m"
    }
  },
  "items": [
    {
      "file_id": "CES-2025-09-015",
      "filename": "northstar_status_2025.csv",
      "cedent": "Northstar Pension Trust",
      "cedent_id": "CED-1042",
      "file_type": "Pension Status",
      "contract_id": "LSC-2024-019",
      "records": 18420,
      "stage": "validated",
      "critical_count": 2,
      "received_at": "2026-05-05T09:00:00Z",
      "sla_deadline": "2026-05-10T17:00:00Z"
    }
  ]
}
```

---

### POST `/cession-files/upload`
Upload a cession file. Initiates the pipeline.

**Request:** `multipart/form-data` — `file` field + optional `cedent_id`, `contract_id`

**Response 201:**
```json
{
  "file_id": "CES-2026-05-018",
  "status": "uploaded",
  "pipeline_session_id": "pipe-uuid",
  "next_stage": "detecting"
}
```

---

### GET `/cession-files/{file_id}`
Get full file detail including current pipeline stage.

**Response 200:**
```json
{
  "file_id": "CES-2025-09-015",
  "filename": "bavarian_fixed_leg_q1.csv",
  "cedent": "Bavarian Industrial Fund",
  "cedent_id": "CED-1201",
  "contract_id": "LSC-2025-002",
  "file_type": "Fixed Leg",
  "records": 4,
  "stage": "detected",
  "stage_history": [
    { "stage": "uploaded", "completed_at": "2026-05-05T09:00:00Z" },
    { "stage": "detecting", "completed_at": "2026-05-05T09:01:00Z" },
    { "stage": "detected", "completed_at": "2026-05-05T09:01:30Z" }
  ],
  "detection": {
    "file_type": "Fixed Leg",
    "file_type_confidence": 0.94,
    "cedent": "Bavarian Industrial Fund",
    "cedent_confidence": 0.99,
    "iris_reasoning": "Filename token match (bavarian_fixed_leg_q1.csv) + column signature + cedant SFTP key matched."
  }
}
```

---

### POST `/cession-files/{file_id}/pipeline/{stage}`
Advance the pipeline to the given stage or perform stage action.

**Stages:** `detect` | `map-contract` | `clauses` | `validate` | `process-exceptions` | `process` | `approve`

**Request (for detect stage):**
```json
{
  "override_file_type": null,
  "override_cedent_id": null
}
```

**Request (for process-exceptions):**
```json
{
  "exception_resolutions": [
    { "exception_id": "uuid", "resolution": "accepted", "override_value": null },
    { "exception_id": "uuid", "resolution": "overridden", "override_value": "8782055" }
  ]
}
```

**Response 200:**
```json
{
  "file_id": "CES-2025-09-015",
  "stage": "validated",
  "result": {
    "records": 4,
    "columns_mapped": 32,
    "critical_errors": 2,
    "warnings": 2,
    "informational": 2,
    "issues": [
      {
        "severity": "critical",
        "row": 100,
        "field": "fixed_leg_amount",
        "issue": "Variance vs contract calc > 1.5%",
        "current_value": "8914200",
        "ai_suggestion": "8782055",
        "ai_confidence": 0.97,
        "clause_reference": "§6.2 ACT/365"
      }
    ]
  }
}
```

**Response (for clauses stage):**
```json
{
  "stage": "clauses",
  "clauses_checked": [
    {
      "clause_id": "§6.2",
      "clause_title": "Fixed Leg Calculation Basis",
      "status": "check_required",
      "description": "ACT/365 basis — fixed amount must match schedule within 1.5%",
      "fields_affected": ["fixed_leg_amount"]
    }
  ]
}
```

---

### GET `/cession-files/{file_id}/pipeline-status`
Poll endpoint for frontend to check pipeline progress.

**Response 200:**
```json
{
  "file_id": "CES-2025-09-015",
  "current_stage": "validating",
  "pct_complete": 55,
  "stage_log": [
    { "stage": "upload", "status": "complete", "timestamp": "..." },
    { "stage": "detect", "status": "complete", "timestamp": "..." },
    { "stage": "map_contract", "status": "complete", "timestamp": "..." },
    { "stage": "clauses", "status": "complete", "timestamp": "..." },
    { "stage": "validate", "status": "in_progress", "timestamp": "..." }
  ]
}
```

---

### GET `/cession-files/{file_id}/summary`
Returns the processing summary for step 8.

**Response 200:**
```json
{
  "file_id": "CES-2025-09-015",
  "contract_id": "LSC-2025-002",
  "file_type": "Fixed Leg",
  "period": "Q1 2025",
  "records_processed": 4,
  "exceptions_resolved": 2,
  "exceptions_overridden": 0,
  "settlement_impact": {
    "fixed_leg_adjustment": -132145,
    "currency": "EUR",
    "settlement_id_created": "SET-2025-Q1-002"
  },
  "population_changes": null,
  "worklist_items_created": 1,
  "audit_trail_id": "uuid",
  "settlement_reconciliation": null
}
```

For `Settlement` files, `settlement_reconciliation` is populated with uploaded/system fixed leg, floating leg, signed fee, signed prior-period interest, net settlement amount, exact-match decision, and mismatch messages. Reconciliation mismatches are summary/worklist review items, not validation exceptions; validation exceptions are limited to missing or invalid file data.

---

## SETTLEMENTS

### GET `/settlements`
List settlements with metrics.

**Query params:** `status`, `contract_id`, `cedent_id`, `period`, `page`, `page_size`

**Response 200:**
```json
{
  "metrics": {
    "pending_approval": 8,
    "pending_amount": 42100000,
    "paid_ytd": 24,
    "dispute_count": 2
  },
  "items": [
    {
      "settlement_id": "SET-2025-Q1-019",
      "contract_id": "LSC-2024-019",
      "cedent_name": "Northstar Pension Trust",
      "period_label": "Q1 2025",
      "fixed_leg": 8420000,
      "floating_leg": 8603000,
      "net_amount": 183000,
      "currency": "GBP",
      "direction": "reinsurer_to_cedant",
      "payment_due": "2025-04-30",
      "status": "pending_approval"
    }
  ]
}
```

---

### GET `/settlements/{settlement_id}`
Full settlement detail.

---

### POST `/settlements/{settlement_id}/approve`
Approve a settlement for payment.

**Request:**
```json
{ "notes": "Approved after variance review" }
```

**Response 200:**
```json
{ "settlement_id": "...", "status": "approved", "approved_at": "..." }
```

---

### POST `/settlements/{settlement_id}/dispute`
Raise a dispute on a settlement.

**Request:**
```json
{ "reason": "Fixed leg amount inconsistent with contract schedule §6.2" }
```

---

## CALCULATION ENGINE

### GET `/calculations/contracts`
List contracts available for calculation.

### POST `/calculations/run`
Run a calculation.

**Request:**
```json
{
  "contract_id": "LSC-2024-019",
  "calculation_type": "settlement",
  "period_start": "2025-01-01",
  "period_end": "2025-03-31"
}
```

**Response 200:**
```json
{
  "calculation_id": "uuid",
  "contract_id": "LSC-2024-019",
  "period": "Q1 2025",
  "fixed_leg": 8420000,
  "floating_leg": 8603000,
  "net": 183000,
  "ae_ratio": 1.018,
  "lives_start": 18420,
  "deaths_actual": 42,
  "deaths_expected": 41.2,
  "bel_current": 892000000,
  "bel_previous": 901000000,
  "bel_change": -9000000
}
```

---

## WORKLIST (Operations — Live)

### GET `/worklist`
Returns worklist items. For `claims_ops` role, returns real DB items.

**Query params:** `priority`, `status`, `category`, `source`, `assigned_to`, `view` (my_tasks|team_tasks|all)

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
  "items": [
    {
      "wl_id": "WL-9202",
      "title": "Settlement variance breach — Northstar Q1-2026",
      "category": "Reconciliation Mismatch",
      "priority": "critical",
      "status": "open",
      "assigned_role": "claims_ops",
      "contract_id": "LSC-2024-019",
      "cedent_name": "Northstar Pension Trust",
      "source": "Tolerance Breach",
      "ai_generated": false,
      "elapsed_display": "Overdue -2h 0m",
      "is_overdue": true,
      "breadcrumb": "Settlement Approval · Variance > 0.5%",
      "created_at": "2026-05-05T07:00:00Z"
    }
  ]
}
```

### PATCH `/worklist/{wl_id}`
Update worklist item status.

**Request:**
```json
{ "status": "in_progress", "notes": "Investigating variance" }
```
