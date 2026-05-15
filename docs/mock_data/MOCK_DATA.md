# IRiS — Mock Data

All mock data below should be stored as JSON files in `backend/app/mock_data/` and loaded by the relevant API endpoints.

---

## users_seed.json
```json
[
  { "email": "admin@metlife-re.demo", "full_name": "Admin User", "role": "super_admin", "password": "admin@2026" },
  { "email": "m.patel@reinsure.io", "full_name": "Mia Patel", "role": "underwriter", "password": "admin@2026" },
  { "email": "a.chen@reinsure.io", "full_name": "Aaron Chen", "role": "claims_ops", "password": "admin@2026" },
  { "email": "j.morales@reinsure.io", "full_name": "Julia Morales", "role": "compliance", "password": "admin@2026" },
  { "email": "d.rhodes@reinsure.io", "full_name": "Devon Rhodes", "role": "admin", "password": "admin@2026" }
]
```

---

## cedents_seed.json
```json
[
  {
    "cedent_id": "CED-0991",
    "legal_entity_name": "Sterling Heritage Pensions",
    "trading_name": "Sterling Heritage",
    "country": "UK",
    "aum_amount": 1200000000,
    "aum_currency": "USD",
    "status": "inactive",
    "screening_status": "cleared",
    "onboarded_date": "2018-09-01",
    "contracts_count": 0,
    "lei": "5299000991ABCD0000EF00",
    "entity_type": "Pension Trust",
    "jurisdiction": "UK",
    "regulatory_status": "Regulated"
  },
  {
    "cedent_id": "CED-1042",
    "legal_entity_name": "Northstar Pension Trust",
    "trading_name": null,
    "country": "UK",
    "aum_amount": 12400000000,
    "aum_currency": "USD",
    "status": "active",
    "screening_status": "cleared",
    "onboarded_date": "2021-03-14",
    "contracts_count": 4,
    "lei": "5299001042ABCD1234EF56",
    "entity_type": "Pension Trust",
    "jurisdiction": "UK",
    "regulatory_status": "Regulated",
    "date_of_incorporation": "1998-06-12"
  },
  {
    "cedent_id": "CED-1087",
    "legal_entity_name": "Helvetia Retirement Fund",
    "trading_name": "Helvetia Re Fund",
    "country": "CH",
    "aum_amount": 8700000000,
    "aum_currency": "USD",
    "status": "active",
    "screening_status": "cleared",
    "onboarded_date": "2022-07-02",
    "contracts_count": 3,
    "lei": "5299001087ABCD5678GH12"
  },
  {
    "cedent_id": "CED-1133",
    "legal_entity_name": "Atlas Corporate Pensions",
    "trading_name": "Atlas Pensions",
    "country": "US",
    "aum_amount": 5300000000,
    "aum_currency": "USD",
    "status": "onboarding",
    "screening_status": "pending",
    "onboarded_date": "2025-01-19",
    "contracts_count": 1
  },
  {
    "cedent_id": "CED-1156",
    "legal_entity_name": "Maple Leaf Pension Plan",
    "trading_name": null,
    "country": "CA",
    "aum_amount": 3900000000,
    "aum_currency": "USD",
    "status": "active",
    "screening_status": "cleared",
    "onboarded_date": "2023-11-08",
    "contracts_count": 2
  },
  {
    "cedent_id": "CED-1201",
    "legal_entity_name": "Bavarian Industrial Fund",
    "trading_name": "Bavarian IF",
    "country": "DE",
    "aum_amount": 6100000000,
    "aum_currency": "USD",
    "status": "active",
    "screening_status": "review",
    "onboarded_date": "2024-04-22",
    "contracts_count": 2
  }
]
```

---

## contracts_seed.json
```json
[
  {
    "contract_id": "LSC-2024-019",
    "contract_name": "Northstar Pension Trust Longevity Swap 2024",
    "contract_version": "v1.2",
    "cedent_id": "CED-1042",
    "swap_type": "Indemnity",
    "structure": "Single tranche",
    "master_agreement_ref": "ISDA-LSC-2024-019",
    "inception_date": "2024-01-15",
    "effective_date": "2024-01-15",
    "maturity_date": "2054-01-15",
    "duration_years": 30,
    "governing_law": "English Law",
    "jurisdiction": "England & Wales",
    "status": "active",
    "notional_amount": 1250000000,
    "currency": "GBP",
    "fixed_leg_rate": 0.0285,
    "fixed_leg_frequency": "Quarterly",
    "floating_leg_definition": "Realized mortality",
    "floating_leg_index": "CMI 2024 SAPS",
    "lives_count": 18420
  },
  {
    "contract_id": "LSC-2024-031",
    "contract_name": "Helvetia Retirement Fund Longevity Swap 2024",
    "contract_version": "v1.0",
    "cedent_id": "CED-1087",
    "swap_type": "Indemnity",
    "structure": "Single tranche",
    "inception_date": "2024-03-01",
    "maturity_date": "2049-03-01",
    "duration_years": 25,
    "governing_law": "English Law",
    "jurisdiction": "England & Wales",
    "status": "active",
    "notional_amount": 870000000,
    "currency": "CHF",
    "fixed_leg_rate": 0.0210,
    "fixed_leg_frequency": "Quarterly",
    "floating_leg_definition": "Realized mortality",
    "lives_count": 12150
  },
  {
    "contract_id": "LSC-2024-044",
    "contract_name": "Maple Leaf Pension Plan Longevity Swap 2024",
    "contract_version": "v1.1",
    "cedent_id": "CED-1156",
    "inception_date": "2024-06-12",
    "maturity_date": "2059-06-12",
    "duration_years": 35,
    "status": "active",
    "notional_amount": 540000000,
    "currency": "CAD",
    "fixed_leg_rate": 0.0305,
    "lives_count": 8900
  },
  {
    "contract_id": "LSC-2025-002",
    "contract_name": "Bavarian Industrial Fund Longevity Swap 2025",
    "contract_version": "v1.0",
    "cedent_id": "CED-1201",
    "inception_date": "2025-02-01",
    "maturity_date": "2055-02-01",
    "duration_years": 30,
    "status": "active",
    "notional_amount": 1120000000,
    "currency": "EUR",
    "fixed_leg_rate": 0.0255,
    "lives_count": 15680
  },
  {
    "contract_id": "LSC-2025-009",
    "contract_name": "Atlas Corporate Pensions Longevity Swap 2025",
    "contract_version": "v1.0",
    "cedent_id": "CED-1133",
    "inception_date": "2025-04-01",
    "maturity_date": "2060-04-01",
    "duration_years": 35,
    "status": "draft",
    "notional_amount": 380000000,
    "currency": "USD",
    "fixed_leg_rate": 0.0320,
    "lives_count": 6200
  }
]
```

---

## population_seed.json (sample — LSC-2024-019)
```json
[
  { "member_id": "PEN-0100234", "contract_id": "LSC-2024-019", "date_of_birth": "1963-04-12", "gender": "F", "annual_pension": 12000, "pension_currency": "GBP", "status": "active", "effective_from": "2024-01-15", "last_verified": "2025-03-31" },
  { "member_id": "PEN-0100236", "contract_id": "LSC-2024-019", "date_of_birth": "1954-07-23", "gender": "F", "annual_pension": 12774, "pension_currency": "GBP", "status": "active", "effective_from": "2024-01-15", "last_verified": "2025-03-31" },
  { "member_id": "PEN-0100238", "contract_id": "LSC-2024-019", "date_of_birth": "1947-02-08", "gender": "F", "annual_pension": 13548, "pension_currency": "GBP", "status": "deceased", "date_of_death": "2025-01-18", "effective_from": "2024-01-15", "last_verified": "2025-03-31" },
  { "member_id": "PEN-0100240", "contract_id": "LSC-2024-019", "date_of_birth": "1941-11-30", "gender": "F", "annual_pension": 14322, "pension_currency": "GBP", "status": "active", "effective_from": "2024-01-15", "last_verified": "2025-03-31" },
  { "member_id": "PEN-0100242", "contract_id": "LSC-2024-019", "date_of_birth": "1963-01-05", "gender": "F", "annual_pension": 15096, "pension_currency": "GBP", "status": "deferred", "effective_from": "2024-01-15", "last_verified": "2025-03-31" },
  { "member_id": "PEN-0100244", "contract_id": "LSC-2024-019", "date_of_birth": "1954-09-14", "gender": "F", "annual_pension": 15870, "pension_currency": "GBP", "status": "active", "effective_from": "2024-01-15", "last_verified": "2025-03-31" },
  { "member_id": "PEN-0100246", "contract_id": "LSC-2024-019", "date_of_birth": "1947-05-19", "gender": "F", "annual_pension": 16644, "pension_currency": "GBP", "status": "active", "effective_from": "2024-01-15", "last_verified": "2025-03-31" },
  { "member_id": "PEN-0100248", "contract_id": "LSC-2024-019", "date_of_birth": "1941-08-27", "gender": "M", "annual_pension": 17418, "pension_currency": "GBP", "status": "deceased", "date_of_death": "2025-02-14", "effective_from": "2024-01-15", "last_verified": "2025-03-31" }
]
```

---

## worklist_seed.json (claims_ops — LIVE DB)
```json
[
  {
    "wl_id": "WL-9202",
    "title": "Settlement variance breach — Northstar Q1-2026",
    "description": "Settlement variance of 3.06% exceeds contract threshold of 1.5%. Manual approval required before payment release.",
    "category": "Reconciliation Mismatch",
    "priority": "critical",
    "status": "open",
    "assigned_role": "claims_ops",
    "contract_id": "LSC-2024-019",
    "cedent_id": "CED-1042",
    "source": "Tolerance Breach",
    "ai_generated": false,
    "sla_deadline": "2026-05-05T09:00:00Z",
    "elapsed_minutes": -120,
    "breadcrumb": "Settlement Approval · Variance > 0.5%"
  },
  {
    "wl_id": "WL-9204",
    "title": "AI mapping failure — CES-2026-04-118 (2 fields unresolved)",
    "description": "Cession file has 2 fields that could not be mapped automatically. Manual review required.",
    "category": "AI Mapping Failure",
    "priority": "high",
    "status": "open",
    "assigned_role": "claims_ops",
    "contract_id": "LSC-2024-031",
    "cedent_id": "CED-1087",
    "source": "AI Agent",
    "ai_generated": true,
    "sla_deadline": "2026-05-05T17:00:00Z",
    "elapsed_minutes": 398,
    "breadcrumb": "Cession Fields · Manual Review Required"
  },
  {
    "wl_id": "WL-9206",
    "title": "SFTP file ingestion failure — Helvetia Q1 cession",
    "description": "SFTP connection to Helvetia endpoint failed. File not received. Retry required.",
    "category": "SFTP Failure",
    "priority": "high",
    "status": "open",
    "assigned_role": "claims_ops",
    "contract_id": "LSC-2024-031",
    "cedent_id": "CED-1087",
    "source": "SFTP",
    "ai_generated": false,
    "sla_deadline": "2026-05-05T12:00:00Z",
    "elapsed_minutes": -45,
    "breadcrumb": "Intake · Reprocessing Required"
  }
]
```

---

## settlements_seed.json (mock)
```json
[
  {
    "settlement_id": "SET-2025-Q1-019",
    "contract_id": "LSC-2024-019",
    "cedent_id": "CED-1042",
    "period_label": "Q1 2025",
    "period_start": "2025-01-01",
    "period_end": "2025-03-31",
    "fixed_leg_amount": 8420000,
    "floating_leg_amount": 8603000,
    "net_amount": 183000,
    "currency": "GBP",
    "direction": "reinsurer_to_cedant",
    "payment_due_date": "2025-04-30",
    "status": "pending_approval"
  },
  {
    "settlement_id": "SET-2025-Q1-031",
    "contract_id": "LSC-2024-031",
    "cedent_id": "CED-1087",
    "period_label": "Q1 2025",
    "period_start": "2025-01-01",
    "period_end": "2025-03-31",
    "fixed_leg_amount": 4557750,
    "floating_leg_amount": 4651950,
    "net_amount": 94200,
    "currency": "CHF",
    "direction": "reinsurer_to_cedant",
    "payment_due_date": "2025-04-30",
    "status": "pending_approval"
  },
  {
    "settlement_id": "SET-2025-Q1-002",
    "contract_id": "LSC-2025-002",
    "cedent_id": "CED-1201",
    "period_label": "Q1 2025",
    "period_start": "2025-01-01",
    "period_end": "2025-03-31",
    "fixed_leg_amount": 7140000,
    "floating_leg_amount": 7008000,
    "net_amount": -132000,
    "currency": "EUR",
    "direction": "cedant_to_reinsurer",
    "payment_due_date": "2025-05-01",
    "status": "approved"
  }
]
```

---

## dashboard_kpis.json (abbreviated — expand per role per DASHBOARD.md)
```json
{
  "admin": {
    "title": "Admin Command Center",
    "subtitle": "Operational control tower · live data · 16 events in last 24h · 8 IRiS actions · 3 critical",
    "kpis": [
      { "label": "Active Users", "value": "184", "trend": "up", "trend_value": "+12 MTD", "subtitle": "Active platform users", "border_color": "green" },
      { "label": "Pending User Approval", "value": "4", "trend": "neutral", "subtitle": "2 elevated", "border_color": "amber" },
      { "label": "Role Change Requests", "value": "6", "trend": "neutral", "subtitle": "Awaiting", "border_color": "blue" },
      { "label": "Access Violations (24h)", "value": "2", "trend": "up", "subtitle": "Investigating", "border_color": "red" },
      { "label": "Failed Logins (24h)", "value": "37", "trend": "up", "subtitle": "5 IPs flagged", "border_color": "red" },
      { "label": "Privileged Access Reviews", "value": "3", "trend": "neutral", "subtitle": "Quarterly cycle", "border_color": "blue" },
      { "label": "Workflow Failures", "value": "1", "trend": "neutral", "subtitle": "Settlement post", "border_color": "amber" },
      { "label": "Batch Job Failures", "value": "2", "trend": "neutral", "subtitle": "Last 24h", "border_color": "amber" },
      { "label": "Ref Data Updates Pending", "value": "5", "trend": "neutral", "subtitle": "Mortality, Curves", "border_color": "amber" },
      { "label": "Integration Health", "value": "9 / 10", "trend": "neutral", "subtitle": "1 degraded", "border_color": "green" },
      { "label": "SFTP Failures (24h)", "value": "1", "trend": "neutral", "subtitle": "Atlas endpoint", "border_color": "red" },
      { "label": "API Failure Alerts", "value": "0", "trend": "neutral", "subtitle": "All healthy", "border_color": "green" },
      { "label": "System Performance", "value": "Nominal", "trend": "neutral", "subtitle": "p95 < 800ms", "border_color": "green" },
      { "label": "Pending Admin Approvals", "value": "8", "trend": "neutral", "subtitle": "Cross-team", "border_color": "blue" }
    ]
  }
}
```

---

## integration_health.json
```json
[
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
```

---

## pending_approvals.json
```json
[
  { "req_id": "REQ-1101", "description": "Elevate u-205 to Underwriting Lead", "requester": "h.suzuki", "status": "pending" },
  { "req_id": "REQ-1102", "description": "Approve mortality table CMI-2024 refresh", "requester": "system", "status": "pending" },
  { "req_id": "REQ-1103", "description": "Reinstate locked cedant — Bavarian", "requester": "j.morales", "status": "pending" }
]
```

---

## sample_cession_files/ (POC demo files — place in backend/static/samples/)

### northstar_status_2025Q1.csv
```csv
member_id,date_of_birth,gender,status,date_of_death,annual_pension,escalation_type,postcode
PEN-0100234,1963-04-12,F,active,,12000,RPI,SW1A 1AA
PEN-0100236,1954-07-23,F,active,,12774,RPI,SW1A 2BB
PEN-0100238,1947-02-08,F,deceased,2025-01-18,13548,RPI,SW1A 3CC
PEN-0100240,1941-11-30,F,active,,14322,RPI,SW1A 4DD
```

### bavarian_fixed_leg_q1.csv
```csv
row_id,period,fixed_leg_amount,currency,fee_amount,value_date,contract_id
100,Q1-2025,8914200,EUR,412300,2025-03-30,LSC-2025-002
237,Q1-2025,8914200,EUR,412300,2025-03-30,LSC-2025-002
374,Q1-2025,8914200,EUR,412300,2025-03-30,LSC-2025-002
511,Q1-2025,8914200,EUR,412300,2025-03-30,LSC-2025-002
```
