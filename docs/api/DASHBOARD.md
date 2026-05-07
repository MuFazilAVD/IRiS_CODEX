# IRiS — Dashboard API

## Base URL: `/api/v1/dashboard`
All endpoints require JWT. Role is read from token to return role-specific data.

---

### GET `/kpis`
Returns KPI card data for the requesting user's role.
Data is read from `mock_data/dashboard_kpis.json`.

**Response 200:**
```json
{
  "role": "underwriter",
  "title": "Underwriting Command Center",
  "subtitle": "Operational control tower · live data · 16 events in last 24h · 8 IRiS actions · 3 critical",
  "quick_actions": [
    { "label": "Upload Population", "action": "navigate:/underwriting/population/upload" },
    { "label": "Review Amendment", "action": "navigate:/underwriting/contracts?filter=amendment" },
    { "label": "Run Experience Analysis", "action": "modal:experience_analysis" },
    { "label": "+ New Cedant", "action": "navigate:/underwriting/cedants/new", "variant": "primary" },
    { "label": "+ New Contract", "action": "navigate:/underwriting/contracts/new", "variant": "primary" }
  ],
  "kpis": [
    {
      "label": "Active Cedants",
      "value": "42",
      "trend": "up",
      "trend_value": "+2 QTD",
      "subtitle": "Pension schemes currently ceding...",
      "border_color": "green"
    }
    // ... more KPIs
  ]
}
```

---

### GET `/intelligence`
Returns "Today's Intelligence" feed cards for the role.
Read from `mock_data/intelligence_feeds.json`.

**Response 200:**
```json
{
  "role": "claims_ops",
  "items": [
    {
      "id": "intel-001",
      "module": "OPS",
      "cedant": "Zurich Assurance",
      "period": "Q1 2026",
      "sla": "12m SLA",
      "flag": "FYA",
      "priority": "HIGH",
      "contract_id": "CON-2026-120",
      "contract_type": "Longevity Swap",
      "message": "Normalization failed due to missing Date of Birth (DOB) values (120 records)",
      "impact": "Mortality calculations cannot proceed. Settlement processing is blocked.",
      "action_label": "Open Worklist",
      "action": "navigate:/worklist?filter=WL-2048"
    }
  ]
}
```

---

### GET `/graphs`
Returns chart data for the role's dashboard graphs.

**Query params:** `?role=underwriter` (optional override for super_admin)

**Response 200:**
```json
{
  "role": "underwriter",
  "graphs": [
    {
      "id": "exposure_by_cedant",
      "title": "Exposure by Cedant",
      "subtitle": "USD bn",
      "type": "bar_horizontal",
      "data": {
        "labels": ["Northstar", "Helvetia", "Bavarian", "Maple"],
        "datasets": [
          { "label": "Exposure", "data": [4.2, 3.1, 2.8, 1.9], "color": "#0D1B2A" }
        ]
      }
    },
    {
      "id": "mortality_expected_vs_actual",
      "title": "Mortality — Expected vs Actual",
      "subtitle": "% rate",
      "type": "line",
      "data": {
        "labels": ["Q1 2024","Q2 2024","Q3 2024","Q4 2024","Q1 2025"],
        "datasets": [
          { "label": "Expected", "data": [0.92, 0.92, 0.92, 0.92, 0.92], "color": "#90A4AE", "dashed": true },
          { "label": "Actual", "data": [0.95, 0.98, 1.02, 1.10, 1.20], "color": "#E74C3C" }
        ]
      }
    },
    {
      "id": "contract_status_distribution",
      "title": "Contract Status Distribution",
      "type": "donut",
      "data": {
        "labels": ["Active", "Draft", "Suspended", "Run-off"],
        "datasets": [{ "data": [38, 4, 2, 3], "colors": ["#0D1B2A","#1A6B9A","#F39C12","#90A4AE"] }]
      }
    }
  ]
}
```

---

### GET `/recent-activities`
Returns recent activity feed (last 24h) for Admin dashboard.

**Response 200:**
```json
{
  "total": 7,
  "items": [
    {
      "id": "act-001",
      "source_type": "SFTP",
      "tags": ["Cession", "FYI"],
      "title": "Received cession file from Northstar SFTP endpoint",
      "timestamp": "2025-04-29T06:02:00Z",
      "cedant": "Northstar Pension Trust",
      "wl_id": "WL-2048",
      "actor": null
    },
    {
      "id": "act-002",
      "source_type": "Admin",
      "actor": "Devon",
      "tags": ["Admin", "FYI"],
      "title": "Created new user account for h.suzuki (Underwriting)",
      "timestamp": "2025-04-28T17:55:00Z",
      "wl_id": "WL-2030"
    }
  ]
}
```

---

## Mock Data Files

### `mock_data/dashboard_kpis.json` structure
```json
{
  "admin": { "title": "...", "kpis": [...] },
  "underwriter": { "title": "...", "kpis": [...] },
  "claims_ops": { "title": "...", "kpis": [...] },
  "compliance": { "title": "...", "kpis": [...] }
}
```

See `mock-data/MOCK_DATA.md` for full JSON values.
