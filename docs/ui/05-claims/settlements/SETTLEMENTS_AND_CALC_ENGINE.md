# IRiS — Settlements & Calculation Engine Pages
## REPLACES: ui/05-claims/settlements/SETTLEMENTS.md + ui/05-claims/calculation-engine/CALC_ENGINE.md

---

# SETTLEMENTS PAGE

**Route:** `/claims/settlements`  
**Auth:** `claims_ops`, `super_admin`

> All settlement data is **mock** for POC. The pipeline (Cession Files → Outcome step) creates the settlement record and routes it here.

---

## Layout

```
Home › Claims & Settlement › Settlements

Settlements

[Pending Approval: 8 · $42.1M]  [Approved: 12]  [Paid YTD: 24]  [Disputes: 2]

[Settlement Approval Status donut chart]   [Reconciliation trend line chart]

Settlement Worklist
[search + filter row]
[table]
```

---

## Metrics Row (4 KPI tiles, left border colored)

| Label | Value | Border |
|-------|-------|--------|
| Pending Approval | 8 | amber |
| Pending Amount | $42.1M | amber |
| Paid YTD | 24 | green |
| Disputes | 2 | red |

---

## Settlement Table

Columns: Settlement ID | Cedant | Period | Fixed Leg | Floating Leg | Net Amount | Direction | Due Date | Status | Actions

```
SET-2025-Q1-019 | Northstar Pension Trust | Q1 2025 | £8,420,000 | £8,603,000 | +£183,000 | Reinsr→Cedant | 2025-04-30 | [Pending Approval] | [View] [Approve]
SET-2025-Q1-031 | Helvetia Retirement Fund| Q1 2025 | CHF4,557,750| CHF4,651,950| +CHF94,200| Reinsr→Cedant | 2025-04-30 | [Pending Approval] | [View] [Approve]
SET-2025-Q1-002 | Bavarian Industrial Fund | Q1 2025 | €7,140,000 | €7,008,000 | -€132,000 | Cedant→Reinsr | 2025-05-01 | [Approved]        | [View]
SET-2025-Q2-019 | Northstar Pension Trust | Q2 2025 | £8,420,000 | £8,310,000 | -£110,000 | Cedant→Reinsr | 2025-07-30 | [Paid]            | [View]
```

**Net Amount coloring:** Positive (reinsurer pays) = green text. Negative (cedant pays) = red text.

**Status badges:**
- `Pending Approval` → amber
- `Approved` → blue
- `Paid` → green
- `Disputed` → red
- `Held` → grey

---

## Settlement Detail Slide-in Panel (click View)

Slides in from right. Width: 480px.

```
Settlement Detail                        [×]
SET-2025-Q1-019

Contract:     LSC-2024-019
Cedant:       Northstar Pension Trust
Period:       Q1 2025 (2025-01-01 → 2025-03-31)
────────────────────────────────────────
Fixed Leg:          £8,420,000
Floating Leg:       £8,603,000
Net Settlement:    +£183,000    ← green
Direction:          Reinsurer pays Cedant
Currency:           GBP
Payment Due:        2025-04-30
────────────────────────────────────────
Status:   Pending Approval
Source:   CES-2025-09-015 (Northstar Q1 2025)

[Approve Settlement]  [Hold Payment]  [Raise Dispute]
```

**[Approve Settlement]** → `POST /api/v1/claims/settlements/{id}/approve` → status = `Approved`  
**[Hold Payment]** → status = `Held` + creates worklist item  
**[Raise Dispute]** → opens reason textarea → status = `Disputed` + creates worklist item

---

# CALCULATION ENGINE PAGE

**Route:** `/claims/calculation-engine`  
**Auth:** `claims_ops`, `super_admin`

> **Important:** The Calculation Engine has two contexts:
> 1. **Standalone page** at `/claims/calculation-engine` — run ad-hoc calculations
> 2. **Embedded in cession file pipeline** — "Calculations" step within the Operations pipeline (IMG_1997)

---

## Standalone Page Layout

```
Home › Claims & Settlement › Calculation Engine

Calculation Engine

[Contract ▾]  [Calc Type ▾]  [Period From ▾]  [Period To ▾]  [Run Calculation]

─────────── Result Panel (appears after run) ───────────

LSC-2024-019 · Northstar Pension Trust · Q1 2025

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│ Fixed Leg    │ │ Floating Leg │ │ Net Position │ │ Pricing Basis            │
│ $1,115,625   │ │ $1,149,750   │ │ -$34,125     │ │ Expected vs Observed     │
│              │ │              │ │ Loss         │ │                          │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────────────────┘

┌────────────────────────────────────────┐  ┌────────────────────────────────────┐
│ Fixed Leg (Expected)                   │  │ Floating Leg (Observed)            │
│ Rate:        4.25%                     │  │ Observed Mortality Rate:  4.38%    │
│ Notional:    $105M                     │  │ Source: Actual death records       │
│ Day Count:   30/360                    │  │ Notional: $105M                    │
│ Period:      Quarterly                 │  │ Period:   Quarterly                │
└────────────────────────────────────────┘  └────────────────────────────────────┘

● Observed mortality exceeds expected by 0.13%    ● Negative payout triggered

[View Calculation Logic]  [Adjust Assumptions · Actuary Only]
```

### Controls
- **Contract dropdown:** All active contracts from DB
- **Calculation Type:** Settlement | Fixed Leg Only | Floating Leg Only | A/E Analysis | BEL
- **Period From/To:** Quarter labels (Q1 2024 → Q4 2026)
- **[Run Calculation]** → `POST /api/v1/claims/calculations/run` → returns result object

### Additional Outputs (below main panel)
- **A/E Ratio:** e.g. 1.018 (observed/expected deaths)
- **BEL:** Present value of all future floating payments
- **Lives Start:** count at period start
- **Deaths Actual / Expected:** integer counts

### Action Buttons
- **[View Calculation Logic]** → expands formula breakdown accordion
- **[Adjust Assumptions · Actuary Only]** → role-gated (underwriter + admin only); opens assumption override modal
- **[Export to Settlement]** → creates a settlement record from this calculation

---

## Embedded Calculation Engine (Within Operations Pipeline)
> Shown as "Calculations – Actuarial Engine" step in the file processing pipeline (IMG_1997).

This is the **same component** but rendered inside the pipeline modal. It auto-runs when the "Calculations" step is reached. Shows:
- Fixed Leg Amount: auto-computed from contract schedule
- Floating Leg Amount: computed from death records in the movement file
- Net Position
- Pricing Basis: "Expected vs Observed"

The "Next Phase →" button advances to Variance Analysis.

---

# OPERATIONS: ACTIVE PIPELINES (UPDATED from IMG_1988)

**Route:** `/claims/cession-files` → clicking a file opens the pipeline detail page (NOT a modal in the V2 screenshots — it's a **full page** with left nav).

## Cession Files List Correction
The older CESSION_FILES.md showed a 10-step modal. The new screenshots show a **full-page pipeline** with a **left-side vertical nav**.

### Updated Pipeline Structure (Left Nav Steps)
```
● Normalization          ← Ingestion & Normalization
● Calculations           ← Actuarial Engine  
● Variance Analysis      ← Deviation Review
● Screening              ← Compliance & AML
● AI Decision            ← Agent Recommendation
● Outcome                ← Workflow Finalization

Pipeline Health: [██████████] Optimal
```

### Breadcrumb
`Operations › ZUR_MOVEMENT_Q1.csv`  
Top right: `Cedant: Zurich Assurance | Period: Q1 2026 | [Abort Process]`

---

## STEP 1: Normalization — Ingestion & Normalization

**Title:** "Ingestion & Normalization"  
**ID:** IRIS-PRC-59206-A | Started: 10:05  
**Right button:** [Options] [Next Phase →]

Five **inner tabs** (horizontal):
`Input Preview | Column Mapping | Normalization Rules | Validation & Data Quality | Normalized Output`

### Inner Tab: Input Preview
**Header:** "Raw Source File Preview (Unstructured)" | Page 1 of 1,016

Table: RED ID | First Name | Last Name | DOB | Monthly Pension | Gender | Spouse Flag | Event Type | Event Date

```
ZUR-8801 | Hans    | Muller  | 15/03/1962 | 2,450.00 | M | Y | Death | 2026-03-01
ZUR-8802 | Petra   | Schmidt |            | 3,120.50 | F | N | Death | 2026-03-02  ← DOB missing (highlighted orange)
ZUR-8803 | Lukas   | Weber   | 22/11/1958 | 1,890.00 | M | Y | Death | 2026-03-01
ZUR-8804 | Monika  | Wagner  |            | 4,500.00 | F | Y | Death | 2026-03-05  ← DOB missing
...
```
Missing DOB cells highlighted in orange/amber.

### Inner Tab: Column Mapping
**Header:** "Source to IRiS Schema Map"

Table: Source Field | Target Field | Transformation
```
RED ID          → Member ID       → Direct Mapping
First Name + Last Name → Full Name → Concatenation & Title Casing
DOB             → DOB            → ISO-8601 Standard (DD/MM/YYYY → YYYY-MM-DD)
DOB             → Age            → Actuarial Calculation (As of 2026-04-27)
Monthly Pension → Monthly Pension → Numeric Conversion (Remove , and .)
Gender          → Gender         → M/F Standardization
Spouse Flag     → Spouse Flag    → Boolean Mapping (Y/N → True/False)
Event Type      → Event Type     → Enum Mapping
Event Date      → Event Date     → ISO-8601 Standard
```

### Inner Tab: Normalization Rules
**Header:** "Active Normalization Logic"

Grid of rule cards (2 columns):
```
DOB → Temporal Standard                          DOB → Age Calculation
Rule: [DD/MM/YYYY] → ISO-8601 [YYYY-MM-DD].     Rule: Calculate derived Age column from
Statistical imputation fallback for missing       normalized DOB relative to valuation date
values using population median.                   (2026-04-27).

Monthly Pension → Precision Mapping              Spouse Flag → Logical Boolean
Rule: Strip currency symbols & thousands          Rule: Map Domain {'Y','Yes','1'} → True;
separators. Cast '2,450.00' → numeric 2450.00.   {'N','No','0'} → False. Critical for
                                                  survivor benefit logic.

First/Last Name → Identity Unification           Gender → Enum Alignment
Rule: Concatenate First + Last → Full Name.       Rule: Standardize {'M','1'} → 'M';
Proper capitalization (hans → Hans).              {'F','2'} → 'F'. Infer from salutation
                                                  if field is ambiguous.

RED ID → Unique Reference
Rule: Direct identifier mapping. Verify checksum if present in cedant header.
```

### Inner Tab: Validation & Data Quality
**KPI chips:** Total Fields: 9 | Fields with Issues: 2 | Fields Corrected: 1 | Fields Inferred: 2

**Filter pills:** All Fields | Issues Only | Modified Only

Table: Field Name | Checked | Issues | Corrected | Inferred | Status | Method Used
```
DOB          | 15,240 | 120 | 120 | 0 | [Fixed]    | Statistical Imputation
Spouse Flag  | 15,240 |   5 |   0 | 5 | [Inferred] | Rule-Based Logic
```

**Risk Indicators section:**
```
Imputed Count: 120 Fields     Inferred Count: 5 Fields
Confidence: 99.4%             Risk Level: [Moderate]
```

**Contextual Controls:**
```
[View Affected Records]  [Override Imputation]  [Flag for Review]
```

---

## STEP 2: Calculations — Actuarial Engine
(See Calculation Engine section above)

---

## STEP 3: Variance Analysis — Deviation Review

**KPI chips (4):**
| Portfolio Variance | Threshold | Breach Status | Impact |
|--------------------|-----------|---------------|--------|
| +1.6% | 2.0% | Within Limit (green) | +$7.6M |

**Variance Breakdown table:**
| Component | Expected | Observed | Variance |
|-----------|----------|----------|----------|
| Mortality Rate | 4.25% | 4.38% | +0.13% (red) |
| Avg Age | 63 | 64 | +1 (red) |
| Claims Count | 1,220 | 1,310 | +90 (red) |

**IRiS insight bullets (below table):**
- Variance driven primarily by higher-than-expected mortality
- Age distribution shift contributes secondary impact

**Action buttons:**
```
[Flag for Review]   [Send to Underwriter ●]
```

---

## STEP 4: Screening — Compliance & AML

**KPI chips (4):**
| Entities Screened | Matches Found | False Positives | Critical Alerts |
|-------------------|---------------|-----------------|-----------------|
| 15,240 | 2 | 1 | 1 (red) |

**Match Table:**
| Entity Name | Match Type | Source | Confidence | Status |
|-------------|-----------|--------|------------|--------|
| Hans Müller | OFAC | OFAC DB | 92% | [Review] (red) |
| Petra Schmidt | FinCEN | FinCEN | 88% | [Cleared] (green) |

**IRiS insight:** "1 entity requires compliance review before settlement"

**Action buttons:**
```
[Escalate to Compliance ●]   [Mark as False Positive]   [Request Additional Data]
```

---

## STEP 5: AI Decision — Agent Recommendation

**KPI chips (4):**
| Confidence Score | Risk Level | Decision | Human Review Required |
|-----------------|-----------|----------|----------------------|
| 94% | Medium (amber) | Conditional Approval | Yes (red) |

**Decision Panel (left card):**
```
✓ Proceed with settlement after resolving compliance flag
✓ Variance within acceptable contract threshold
✓ Data quality issues resolved via imputation
```

**Flags (right card):**
```
⚠ Compliance review pending
⚠ Imputed DOB used for 120 records
```

**Action buttons:**
```
[Approve & Proceed ●]   [Escalate]   [Request Manual Review]
```

---

## STEP 6: Outcome — Workflow Finalization

**KPI chips (4):**
| Final Status | Settlement Amount | Approval Required | SLA Status |
|-------------|------------------|-------------------|------------|
| Pending Approval (amber) | $1.149M | Yes | At Risk (red) |

**Summary Panel:**
```
Contract:         Zurich Assurance Q1 2026
Total Records:    15,240
Issues Resolved:  Yes
Compliance:       Pending 1 review
```

**Action buttons:**
```
[Approve Settlement ●]   [Hold Payment]   [Reject Case]
```

Top-right: **[Workflow Complete +]** button (teal, appears when approved)

---

## WORKLIST DETAIL PAGE (from IMG_1985)

When a worklist item is clicked from the Worklist page, it opens a **full-page detail** (not a drawer).

**Breadcrumb:** `Operations › ZUR_MOVEMENT_Q1.csv`  
**Header card (dark navy):** "Data Normalization Failure — Missing DOB (120 records)" | FILE-9921 · Q1 2026 | [BLOCKING] badge (red)

**Left column:**
```
ISSUE
Normalization failed due to missing Date of Birth (DOB) values in 120 records.

ROOT CAUSE
Required field 'Date of Birth (DOB)' is missing in 120 records. No schema or 
column mapping mismatch detected.

IMPACT
Mortality calculations cannot be completed. Settlement processing is blocked 
until data is resolved or imputed.

REQUIRED ACTION (amber card)
Provide missing DOB values or proceed with statistical imputation.
```

**Right column — DECISION METRICS:**
```
Total Records     15,240
Affected          120  (red)
Confidence        94%
Projected Downstream Impact
Variance          +2.1% (red)
Last Updated      12m ago
Assigned To       Operations Team A
```

**Bottom action buttons:**
```
[✉ Request Data]   [Impute]
```

**Bottom-right (fixed):**
```
[Go to Workflow →] (dark navy)
```
