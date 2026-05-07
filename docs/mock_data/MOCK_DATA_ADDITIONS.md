# IRiS — Mock Data Additions
## APPENDS TO: mock-data/MOCK_DATA.md

---

## pipeline_seed.json
Active pipelines seeded for the Operations page (IMG_1988).

```json
[
  {
    "process_id": "IRIS-PRC-59205-A",
    "filename": "Phoenix_Q1_2026_ML.csv",
    "cedent": "Phoenix Re",
    "cedent_id": "CED-PHRE",
    "received_at": "2024-04-23T09:42:00Z",
    "priority": "High",
    "current_step": "Variance Analysis",
    "pipeline_health": "Optimal",
    "normalization_status": "complete",
    "calculations_status": "complete",
    "variance_analysis_status": "in_progress",
    "screening_status": "pending",
    "ai_decision_status": "pending",
    "outcome_status": "pending"
  },
  {
    "process_id": "IRIS-PRC-59206-A",
    "filename": "ZUR_MOVEMENT_Q1.csv",
    "cedent": "Zurich Assurance",
    "cedent_id": "CED-ZUR",
    "received_at": "2024-04-24T10:05:00Z",
    "priority": "Medium",
    "current_step": "Normalization",
    "pipeline_health": "Optimal",
    "normalization_status": "in_progress",
    "total_records": 15240,
    "affected_records": 120,
    "period": "Q1 2026"
  },
  {
    "process_id": "IRIS-PRC-59207-A",
    "filename": "Allianz_Final_TrueUp_2025.csv",
    "cedent": "Allianz SE",
    "cedent_id": "CED-ALZ",
    "received_at": "2024-04-22T14:30:00Z",
    "priority": "Critical",
    "current_step": "AI Decisioning",
    "pipeline_health": "Optimal",
    "normalization_status": "complete",
    "calculations_status": "complete",
    "variance_analysis_status": "complete",
    "screening_status": "complete",
    "ai_decision_status": "in_progress",
    "outcome_status": "pending"
  },
  {
    "process_id": "IRIS-PRC-59208-A",
    "filename": "L&G_Bulk_Longevity_P2.zip",
    "cedent": "Legal & General",
    "cedent_id": "CED-LNG",
    "received_at": "2024-04-24T08:15:00Z",
    "priority": "High",
    "current_step": "Normalisation",
    "pipeline_health": "Optimal",
    "normalization_status": "in_progress"
  }
]
```

---

## normalization_detail_seed.json
Full normalization data for ZUR_MOVEMENT_Q1.csv (IRIS-PRC-59206-A).

```json
{
  "process_id": "IRIS-PRC-59206-A",
  "filename": "ZUR_MOVEMENT_Q1.csv",
  "cedent": "Zurich Assurance",
  "period": "Q1 2026",
  "started_at": "2024-04-24T10:05:00Z",
  "input_preview": {
    "total_pages": 1016,
    "columns": ["RED ID","First Name","Last Name","DOB","Monthly Pension","Gender","Spouse Flag","Event Type","Event Date"],
    "rows": [
      {"RED ID":"ZUR-8801","First Name":"Hans","Last Name":"Muller","DOB":"15/03/1962","Monthly Pension":"2,450.00","Gender":"M","Spouse Flag":"Y","Event Type":"Death","Event Date":"2026-03-01","dob_issue":false},
      {"RED ID":"ZUR-8802","First Name":"Petra","Last Name":"Schmidt","DOB":"","Monthly Pension":"3,120.50","Gender":"F","Spouse Flag":"N","Event Type":"Death","Event Date":"2026-03-02","dob_issue":true},
      {"RED ID":"ZUR-8803","First Name":"Lukas","Last Name":"Weber","DOB":"22/11/1958","Monthly Pension":"1,890.00","Gender":"M","Spouse Flag":"Y","Event Type":"Death","Event Date":"2026-03-01","dob_issue":false},
      {"RED ID":"ZUR-8804","First Name":"Monika","Last Name":"Wagner","DOB":"","Monthly Pension":"4,500.00","Gender":"F","Spouse Flag":"Y","Event Type":"Death","Event Date":"2026-03-05","dob_issue":true},
      {"RED ID":"ZUR-8805","First Name":"Klaus","Last Name":"Becker","DOB":"05/09/1960","Monthly Pension":"2,750.00","Gender":"M","Spouse Flag":"N","Event Type":"Death","Event Date":"2026-03-01","dob_issue":false},
      {"RED ID":"ZUR-8806","First Name":"Renate","Last Name":"Hoffmann","DOB":"12/07/1955","Monthly Pension":"3,400.00","Gender":"F","Spouse Flag":"Y","Event Type":"Death","Event Date":"2026-03-04","dob_issue":false},
      {"RED ID":"ZUR-8807","First Name":"Andreas","Last Name":"Schulz","DOB":"","Monthly Pension":"2,100.00","Gender":"M","Spouse Flag":"Y","Event Type":"Death","Event Date":"2026-03-01","dob_issue":true},
      {"RED ID":"ZUR-8808","First Name":"Sabine","Last Name":"Koch","DOB":"28/02/1964","Monthly Pension":"3,800.00","Gender":"F","Spouse Flag":"N","Event Type":"Death","Event Date":"2026-03-08","dob_issue":false},
      {"RED ID":"ZUR-8809","First Name":"Stefan","Last Name":"Richter","DOB":"14/10/1959","Monthly Pension":"2,950.00","Gender":"M","Spouse Flag":"Y","Event Type":"Death","Event Date":"2026-03-01","dob_issue":false}
    ]
  },
  "column_mapping": [
    {"source_field":"RED ID","target_field":"Member ID","transformation":"Direct Mapping"},
    {"source_field":"First Name + Last Name","target_field":"Full Name","transformation":"Concatenation & Title Casing"},
    {"source_field":"DOB","target_field":"DOB","transformation":"ISO-8601 Standard (DD/MM/YYYY → YYYY-MM-DD)"},
    {"source_field":"DOB","target_field":"Age","transformation":"Actuarial Calculation (As of 2026-04-27)"},
    {"source_field":"Monthly Pension","target_field":"Monthly Pension","transformation":"Numeric Conversion (Remove , and .)"},
    {"source_field":"Gender","target_field":"Gender","transformation":"M/F Standardization"},
    {"source_field":"Spouse Flag","target_field":"Spouse Flag","transformation":"Boolean Mapping (Y/N → True/False)"},
    {"source_field":"Event Type","target_field":"Event Type","transformation":"Enum Mapping"},
    {"source_field":"Event Date","target_field":"Event Date","transformation":"ISO-8601 Standard"}
  ],
  "validation": {
    "total_fields": 9,
    "fields_with_issues": 2,
    "fields_corrected": 1,
    "fields_inferred": 2,
    "field_validations": [
      {"field_name":"DOB","checked":15240,"issues":120,"corrected":120,"inferred":0,"status":"Fixed","method_used":"Statistical Imputation"},
      {"field_name":"Spouse Flag","checked":15240,"issues":5,"corrected":0,"inferred":5,"status":"Inferred","method_used":"Rule-Based Logic"}
    ],
    "risk_indicators": {"imputed_count":120,"inferred_count":5,"confidence":0.994,"risk_level":"Moderate"}
  }
}
```

---

## calculations_detail_seed.json
Actuarial Engine output for ZUR_MOVEMENT_Q1.csv.

```json
{
  "process_id": "IRIS-PRC-59206-A",
  "fixed_leg_amount": 1115625,
  "floating_leg_amount": 1149750,
  "net_position": -34125,
  "net_direction": "Loss",
  "currency": "USD",
  "pricing_basis": "Expected vs Observed",
  "fixed_leg": {
    "rate": 0.0425,
    "notional": 105000000,
    "day_count": "30/360",
    "period": "Quarterly"
  },
  "floating_leg": {
    "observed_mortality_rate": 0.0438,
    "source": "Actual death records",
    "notional": 105000000,
    "period": "Quarterly"
  },
  "insights": [
    "Observed mortality exceeds expected by 0.13%",
    "Negative payout triggered"
  ]
}
```

---

## variance_analysis_seed.json

```json
{
  "process_id": "IRIS-PRC-59206-A",
  "portfolio_variance_pct": 1.6,
  "threshold_pct": 2.0,
  "breach_status": "Within Limit",
  "impact_amount": 7600000,
  "impact_currency": "USD",
  "breakdown": [
    {"component":"Mortality Rate","expected":4.25,"observed":4.38,"variance":0.13},
    {"component":"Avg Age","expected":63,"observed":64,"variance":1},
    {"component":"Claims Count","expected":1220,"observed":1310,"variance":90}
  ],
  "insights": [
    "Variance driven primarily by higher-than-expected mortality",
    "Age distribution shift contributes secondary impact"
  ],
  "actions": ["flag_for_review","send_to_underwriter"]
}
```

---

## screening_detail_seed.json

```json
{
  "process_id": "IRIS-PRC-59206-A",
  "entities_screened": 15240,
  "matches_found": 2,
  "false_positives": 1,
  "critical_alerts": 1,
  "match_table": [
    {
      "entity_name": "Hans Müller",
      "match_type": "OFAC",
      "source": "OFAC DB",
      "confidence": 0.92,
      "status": "Review"
    },
    {
      "entity_name": "Petra Schmidt",
      "match_type": "FinCEN",
      "source": "FinCEN",
      "confidence": 0.88,
      "status": "Cleared"
    }
  ],
  "insight": "1 entity requires compliance review before settlement"
}
```

---

## ai_decision_seed.json

```json
{
  "process_id": "IRIS-PRC-59206-A",
  "confidence_score": 0.94,
  "risk_level": "Medium",
  "decision": "Conditional Approval",
  "human_review_required": true,
  "decision_panel": [
    {"status":"approved","text":"Proceed with settlement after resolving compliance flag"},
    {"status":"approved","text":"Variance within acceptable contract threshold"},
    {"status":"approved","text":"Data quality issues resolved via imputation"}
  ],
  "flags": [
    {"severity":"warning","text":"Compliance review pending"},
    {"severity":"warning","text":"Imputed DOB used for 120 records"}
  ],
  "actions": ["approve_and_proceed","escalate","request_manual_review"]
}
```

---

## outcome_seed.json

```json
{
  "process_id": "IRIS-PRC-59206-A",
  "final_status": "Pending Approval",
  "settlement_amount": 1149000,
  "settlement_currency": "USD",
  "approval_required": true,
  "sla_status": "At Risk",
  "summary": {
    "contract": "Zurich Assurance Q1 2026",
    "total_records": 15240,
    "issues_resolved": true,
    "compliance": "Pending 1 review"
  },
  "actions": ["approve_settlement","hold_payment","reject_case"]
}
```

---

## worklist_items_additional.json
Additional worklist items beyond the 3 seeded for claims_ops.

```json
[
  {
    "wl_id": "WL-9201",
    "title": "OFAC sanctions match — Atlas Corporate Pensions",
    "category": "OFAC Match",
    "priority": "critical",
    "status": "open",
    "assigned_role": "compliance",
    "compliance_hold": true,
    "contract_id": "LSC-2025-009",
    "cedent_id": "CED-1133",
    "source": "AI Agent",
    "ai_generated": true,
    "elapsed_display": "8h 47m",
    "breadcrumb": "Compliance Hold · Review Required",
    "extra": {"variance": "+USD 720M Financial impact", "confidence": "92%"}
  },
  {
    "wl_id": "WL-9203",
    "title": "Manual override approval — CMI 2024 mortality scaling",
    "category": "Override Approval",
    "priority": "critical",
    "status": "open",
    "assigned_role": "underwriter",
    "contract_id": "LSC-2024-019",
    "cedent_id": "CED-1042",
    "source": "Approval Matrix",
    "ai_generated": false,
    "elapsed_display": "1h 35m",
    "breadcrumb": "Override Review · Chief Actuary Sign-off Required",
    "extra": {"financial_impact": "-GBP 3.18M"}
  },
  {
    "wl_id": "WL-9205",
    "title": "Contract amendment review — LSC-2024-019 v1.3 (LIBOR→SOFR)",
    "category": "Contract Amendment",
    "priority": "high",
    "status": "open",
    "assigned_role": "underwriter",
    "contract_id": "LSC-2024-019",
    "cedent_id": "CED-1042",
    "source": "Human",
    "ai_generated": false,
    "elapsed_display": "8h 0m",
    "breadcrumb": "Underwriting Review · Senior Sign-off",
    "extra": {"financial_impact": "+GBP 1.84M"}
  },
  {
    "wl_id": "WL-9208",
    "title": "Sensitive export alert — Q1 financial impact report",
    "category": "Sensitive Export",
    "priority": "medium",
    "status": "open",
    "assigned_role": "compliance",
    "source": "Audit Control",
    "ai_generated": false,
    "elapsed_display": "15h 20m",
    "breadcrumb": "Access Audit · Review Required"
  },
  {
    "wl_id": "WL-9211",
    "title": "Failed login spike — possible credential stuffing",
    "category": "Access Audit",
    "priority": "high",
    "status": "open",
    "assigned_role": "admin",
    "source": "System Rule",
    "ai_generated": false,
    "elapsed_display": "1h 50m",
    "breadcrumb": "Security · Investigation"
  },
  {
    "wl_id": "WL-9213",
    "title": "Role entitlement approval — Compliance role grant",
    "category": "Role Assignment",
    "priority": "medium",
    "status": "open",
    "assigned_role": "admin",
    "source": "Human",
    "ai_generated": false,
    "elapsed_display": "28h 0m",
    "breadcrumb": "Identity · Privilege Review"
  }
]
```

---

## dashboard_kpis_additions.json
Add these sections to dashboard_kpis.json.

```json
{
  "underwriter": {
    "quick_actions": [
      {"label":"Upload Population","action":"navigate:/underwriting/population/upload"},
      {"label":"Review Amendment","action":"navigate:/underwriting/contracts?filter=amendment"},
      {"label":"Run Experience Analysis","action":"modal:experience_analysis"},
      {"label":"+ New Cedant","action":"navigate:/underwriting/cedants/new","variant":"primary"},
      {"label":"+ New Contract","action":"navigate:/underwriting/contracts/new","variant":"primary"}
    ],
    "graphs": {
      "population_movement": {
        "type":"area",
        "title":"Population Movement (000s)",
        "labels":["Nov","Dec","Jan","Feb","Mar","Apr"],
        "data":[590,597,604,608,612,617]
      },
      "renewal_pipeline": {
        "type":"grouped_bar",
        "title":"Renewal Pipeline",
        "subtitle":"Notional $bn",
        "labels":["0–30d","31–60d","61–90d","91–180d"],
        "series":[
          {"name":"contracts","data":[0.75,0.75,2.0,3.0],"color":"#00BCD4"},
          {"name":"notional","data":[0.75,0.8,1.4,2.3],"color":"#0D1B2A"}
        ]
      },
      "high_risk_cedants": [
        {"name":"Atlas Corporate Pensions","badge":"Critical","reason":"OFAC review"},
        {"name":"Bavarian Industrial Fund","badge":"Review","reason":"Mortality variance > 15%"},
        {"name":"Northstar Pension Trust","badge":"Review","reason":"Concentration risk"}
      ]
    }
  },
  "claims_ops": {
    "graphs": {
      "file_processing_pipeline": {
        "type":"bar",
        "title":"File Processing Pipeline",
        "labels":["Validation","Cleansing","Output"],
        "data":[24,7,19]
      },
      "reconciliation_exception_trend": {
        "type":"dual_line",
        "title":"Reconciliation Exception Trend",
        "labels":["Nov","Dec","Jan","Feb","Mar","Apr"],
        "series":[
          {"name":"breaks","data":[15,12,8,14,16,11],"color":"#E74C3C"},
          {"name":"resolved","data":[12,11,9,12,14,8],"color":"#2ECC71"}
        ]
      },
      "cedant_file_delivery": {
        "type":"grouped_bar",
        "title":"Cedant File Delivery (30d)",
        "subtitle":"on-time vs late",
        "labels":["Northstar","Helvetia","Maple Leaf","Atlas"],
        "series":[
          {"name":"onTime","data":[27,24,18,16],"color":"#2ECC71"},
          {"name":"late","data":[0,1,1,8],"color":"#E74C3C"}
        ]
      },
      "high_impact_exceptions": [
        {"id":"EXC-4421","description":"Unmapped fields × 12 — Helvetia","impact":"$0.4M"},
        {"id":"EXC-4422","description":"Recon break > tolerance — Maple Leaf","impact":"CAD 540K"},
        {"id":"EXC-4423","description":"Late SFTP delivery — Atlas","impact":"—"}
      ]
    }
  },
  "compliance": {
    "graphs": {
      "screening_status_by_cedant": {
        "type":"stacked_bar",
        "title":"Screening Status by Cedant",
        "labels":["Northstar","Helvetia","Maple Leaf","Atlas"],
        "series":[
          {"name":"clear","data":[1900,1550,900,950],"color":"#2ECC71"},
          {"name":"hits","data":[0,0,0,50],"color":"#E74C3C"}
        ]
      },
      "override_trend": {
        "type":"area_line",
        "title":"Override Trend (6m)",
        "labels":["Nov","Dec","Jan","Feb","Mar","Apr"],
        "data":[4,5,3,7,6,8]
      },
      "audit_risk_heatmap": {
        "areas":["Underwriting","Cession","Settlement","Compliance","Admin"],
        "columns":["Low","Medium","High"],
        "data":[[2,1,null],[4,2,1],[1,2,1],[3,null,null],[1,1,null]]
      },
      "active_screening_hits": [
        {"name":"Sergei V. Markov","status":"Escalated","match_type":"OFAC SDN","confidence":0.88},
        {"name":"John A. Whitcomb","status":"Pending Review","match_type":"FinCEN 314(a)","confidence":0.71},
        {"name":"Atlas Corporate Pensions","status":"Under Review","match_type":"OFAC SDN","confidence":0.42}
      ]
    }
  }
}
```

---

## contract_management_mock.json
For the older-style Contract Management page seen in IMG_1986.

```json
{
  "total": 142,
  "contracts": [
    {"contract_id":"CON-2024-001","counterparty":"Phoenix Re","status":"Active","notional":"$1,25,00,00,000","frequency":"Quarterly","basis":"LGL_LON_V3.2","next_settlement":"2026-06-30"},
    {"contract_id":"CON-2024-042","counterparty":"Zurich Assurance","status":"Active","notional":"$85,00,00,000","frequency":"Monthly","basis":"LGL_LON_V3.2","next_settlement":"2026-06-30"},
    {"contract_id":"CON-2025-012","counterparty":"Global Life","status":"Draft","notional":"$2,10,00,00,000","frequency":"Quarterly","basis":"LGL_LON_V3.2","next_settlement":"2026-06-30"},
    {"contract_id":"CON-2023-088","counterparty":"BLUEHOUR GROUP","status":"Active","notional":"$45,00,00,000","frequency":"Quarterly","basis":"LGL_LON_V3.2","next_settlement":"2026-06-30"}
  ]
}
```

---

## intelligence_feeds_complete.json
Complete intelligence feed for all roles (extends earlier mock).

```json
{
  "claims_ops": [
    {
      "module":"OPS","cedant":"Zurich Assurance","period":"Q1 2026","sla":"12m SLA",
      "flag":"FYA","priority":"HIGH","contract_id":"CON-2026-120","contract_type":"Longevity Swap",
      "message":"Normalization failed due to missing Date of Birth (DOB) values (120 records)",
      "impact":"Mortality calculations cannot proceed. Settlement processing is blocked.",
      "action_label":"Open Worklist","action":"navigate:/worklist?id=WL-9202"
    }
  ],
  "underwriter": [
    {
      "module":"UNDERWRITING","cedant":"Phoenix Re","period":"Q1 2026",
      "flag":"FYA","priority":"MEDIUM","contract_id":"CON-2024-001","contract_type":"Bulk Annuity",
      "message":"Variance of 3.06% exceeds contract threshold",
      "impact":"Settlement requires manual approval",
      "action_label":"View Analysis","action":"navigate:/contracts/CON-2024-001"
    }
  ],
  "compliance": [
    {
      "module":"RISK","cedant":"Zurich Assurance","period":"Q1 2026",
      "flag":"FYI","priority":"LOW","contract_id":"CON-8821","contract_type":"Group Life",
      "message":"All entities cleared against sanctions lists",
      "impact":"No action required",
      "action_label":"View Compliance Report","action":"navigate:/compliance/sanctions"
    }
  ],
  "admin": [
    {
      "module":"ADMIN","cedant":null,"period":null,
      "flag":"FYA","priority":"HIGH",
      "message":"Atlas SFTP integration degraded (last 2 cycles). 4 user provisioning requests pending.",
      "impact":"2 require elevated entitlement review.",
      "action_label":"Review","action":"navigate:/admin/users"
    }
  ]
}
```
