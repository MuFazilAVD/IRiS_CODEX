# IRiS — Reports Page

**Route:** `/reports`
**Auth:** All roles (filtered by role entitlements)
**POC Status:** Fully mock — all report data is hardcoded JSON. No real report engine.

---

## Layout

```
Home › Reporting › Report Catalog

Reports                                    [Hide filters]  [Schedule]  [↓ Export selected]
Reporting intelligence layer — historical, financial, operational, compliance, actuarial and audit

[KPI tiles row]

LEFT SIDEBAR                    RIGHT CONTENT
────────────────────            ──────────────────────────────────────────────────
Categories                      Global filters panel
  All Reports       23
  Historical Reports  4          [Global filters]
  Dynamic Reports     2          Cedant     Contract   Reporting period  Valuation date  Assumption set
  Debugging Reports   2          [All ▾]    [All ▾]    [2025 Q1 ▾]      [03/31/2025]    [v3.2 ▾]
  Movement Reports    3          Currency   Movement type  Compliance status  Approval status  Search
  Compliance Reports  3          [All ▾]    [All ▾]        [All ▾]            [All ▾]          [🔍]
  Financial Reports   5
  Admin & Access      4          [Save]  [Reset]

Quick actions                   23 reports · 0 selected              [☐ Select all]
  📄 Export Excel
  📄 Export PDF                  Report table
  🔒 Regulatory pack
  ✉ Distribution list
```

---

## KPI Tiles (4)

| Available reports | Sensitive / regulator | Report categories | Scheduled cadence |
|------|------|------|------|
| 23 | 11 | 7 | 20 |
| Super Admin entitlements | extra audit applied | across the platform | auto-distribution |

Border colors: blue, red, teal, green

---

## Report Categories (Left sidebar)

All Reports (23), Historical Reports (4), Dynamic Reports (2), Debugging Reports (2), Movement Reports (3), Compliance Reports (3), Financial Reports (5), Admin & Access Reports (4)

---

## Global Filters

All dropdowns with these options:
- **Cedant:** All | Northstar Pension Trust | Helvetia Retirement Fund | Bavarian Industrial Fund | Maple Leaf Pension Plan | Atlas Corporate Pensions
- **Contract:** All | LSC-2024-019 | LSC-2024-031 | LSC-2024-044 | LSC-2025-002 | LSC-2025-009
- **Reporting period:** 2025 Q1 | 2025 Q2 | 2025 Q3 | 2025 Q4 | 2024 Q1 etc.
- **Valuation date:** date picker (default 03/31/2025)
- **Assumption set:** v3.2 | v3.1 | v3.0
- **Currency:** All | GBP | USD | EUR | CHF | CAD
- **Movement type:** All | Death | Deferred | Active | Spouse
- **Compliance status:** All | Clear | Review | Escalated
- **Approval status:** All | Pending | Approved | Disputed

---

## Report Table

Columns: ☐ (checkbox) | Report | Category | Cadence | Distribution | Sensitivity | Actions

### Historical Reports (4)

| Report | Category | Cadence | Distribution | Sensitivity | Actions |
|--------|----------|---------|--------------|-------------|---------|
| **Settlement Calculation Report** RPT-H-001 · Settlement generated for a contract over a reporting period including fixed/floating legs and adjustments. | Historical | Quarterly | Claims Ops, Finance, Cedant Relationship | Sensitive | [Open →] |
| **Control Report** RPT-H-002 · Control checks and reconciliation breaks for financial accuracy. | Historical | Monthly | Claims Ops, Internal Audit | Standard | [Open →] |
| **Collateral Exposure Calculation** RPT-H-003 · Collateral and reserve exposure visibility per cedant and contract. | Historical | Monthly | Risk, Treasury | Standard | [Open →] |
| **Cash Flows** RPT-H-004 · Projected and actual cashflow reporting per contract and year. | Historical | Quarterly | Treasury, Finance | Standard | [Open →] |

### Dynamic Reports (2)

| Report | Category | Cadence | Distribution | Sensitivity | Actions |
|--------|----------|---------|--------------|-------------|---------|
| **Historical Fixed and Floating Legs** RPT-D-001 · Trend analysis of fixed vs floating payments with mortality impact. | Dynamic | Quarterly | Actuarial, Risk | Standard | [Open →] |
| **Sanity Check Report** RPT-D-002 · Validation report for suspicious movements and unusual liability changes. | Dynamic | Monthly | Claims Ops, Actuarial | Standard | [Open →] |

### Movement Reports (3)

| Report | Category | Cadence | Distribution | Sensitivity | Actions |
|--------|----------|---------|--------------|-------------|---------|
| **Pensioner Movement Summary** RPT-M-001 · Deaths, deferrals, transfers per period. | Movement | Monthly | Actuarial, Claims Ops | Standard | [Open →] |
| **Population Delta Report** RPT-M-002 · Net change in covered population by age band. | Movement | Quarterly | Actuarial, Underwriting | Standard | [Open →] |
| **Spouse & Dependant Events** RPT-M-003 · Spouse benefit triggers and survivor elections. | Movement | Monthly | Claims Ops | Standard | [Open →] |

### Compliance Reports (3)

| Report | Category | Cadence | Distribution | Sensitivity | Actions |
|--------|----------|---------|--------------|-------------|---------|
| **Sanctions Screening Summary** RPT-C-001 · All screening runs, matches and dispositions. | Compliance | Monthly | Compliance, Legal | Sensitive | [Open →] |
| **Regulatory Submission Pack** RPT-C-002 · PRA/EIOPA/NAIC formatted quarterly pack. | Compliance | Quarterly | Compliance, Regulator | Sensitive | [Open →] |
| **KYC & AML Status Report** RPT-C-003 · AML and KYC expiry tracker per cedant. | Compliance | Annual | Compliance | Sensitive | [Open →] |

### Financial Reports (5)

| Report | Category | Cadence | Distribution | Sensitivity | Actions |
|--------|----------|---------|--------------|-------------|---------|
| **BEL Valuation Report** RPT-F-001 · Best Estimate Liability across all contracts. | Financial | Quarterly | Actuarial, Finance, Risk | Sensitive | [Open →] |
| **Net Settlement P&L** RPT-F-002 · Net payout position across all cedants. | Financial | Quarterly | Finance, Senior Management | Sensitive | [Open →] |
| **FX Exposure Report** RPT-F-003 · Multi-currency exposure and hedging requirement. | Financial | Monthly | Treasury | Standard | [Open →] |
| **Collateral Adequacy** RPT-F-004 · Threshold monitoring and top-up triggers. | Financial | Monthly | Risk, Treasury | Standard | [Open →] |
| **Experience Study** RPT-F-005 · A/E mortality analysis vs CMI baseline. | Financial | Annual | Actuarial, Underwriting | Standard | [Open →] |

### Admin & Access Reports (4)

| Report | Category | Cadence | Distribution | Sensitivity | Actions |
|--------|----------|---------|--------------|-------------|---------|
| **User Access Audit** RPT-A-001 · All access events, permission changes, failed logins. | Admin | Monthly | IT Admin, Compliance | Sensitive | [Open →] |
| **Role Change Log** RPT-A-002 · All role elevations and approvals. | Admin | Monthly | IT Admin | Standard | [Open →] |
| **System Performance Log** RPT-A-003 · Pipeline throughput, SLA adherence. | Admin | Weekly | IT Admin | Standard | [Open →] |
| **AI Override Governance** RPT-A-004 · All AI overrides with approver sign-off. | Admin | Monthly | Compliance, Senior Management | Sensitive | [Open →] |

---

## Report Detail (clicking Open →)

Opens a full-page or slide-in showing:
- Report metadata (ID, cadence, distribution)
- Filter summary (what filters were applied)
- Mock table/chart data for the report
- [Download CSV] [Download PDF] buttons

**POC:** Each report opens a static mock page with hardcoded sample rows. No real computation.

---

## Sensitivity Labels

- **Sensitive** → red badge, only visible to roles with entitlement (super_admin, compliance)
- **Standard** → grey badge, visible to all roles with report access

## Quick Actions (Left sidebar)

- **Export Excel** → downloads selected reports as .xlsx (mock: download pre-generated file)
- **Export PDF** → downloads as .pdf
- **Regulatory pack** → bundles compliance reports into a zip (mock)
- **Distribution list** → shows/edits email distribution per report (mock)

---

## Chatbot Integration
The chatbot (IRiS Assist) can answer: "Show me the Q1 settlement report for Northstar" → navigates to `/reports?filter=RPT-H-001&cedant=CED-1042&period=Q1-2025`
