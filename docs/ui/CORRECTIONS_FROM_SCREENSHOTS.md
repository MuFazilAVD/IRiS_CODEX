# IRiS — Contract Detail: Corrected Tabs from Screenshots

This file SUPPLEMENTS and OVERRIDES the relevant sections of CONTRACTS.md with exact field data from screenshots.

---

## REPORTS CATALOG VISUAL CORRECTIONS

From `docs/ui-screens/Reports/Reports(1).png` and `Reports(2).png`:

- The Reports catalog uses sharper bordered boxes rather than the softer large-radius card treatment
- KPI tiles are plain bordered summary boxes with compact text sizing and no dashboard-style accent rails
- The left Categories rail is a flat navigation column with icons, a tighter active state, and a vertical divider, not a rounded card block
- The Global filters panel is a compact bordered box with field labels above each control and denser spacing
- The report table uses smaller typography, lighter row density, and compact outline action buttons

---

## CESSION FILE PROCESSING ROUTE PRESENTATION

From the full-page cession processing screenshot provided during implementation:

- The cession-file upload/history workflow should open as a full page when launched from the queue or upload action
- The existing 10-step processing flow remains the same, but it should render inside a routed page shell rather than a fixed overlay modal
- The full-page version includes a page-level back action and retains the step bar, upload/detect/map/clauses/validate/exceptions/process/summary/worklist/audit flow

---

## SETTLEMENTS REGISTER VISUAL CORRECTIONS

From `docs/ui-screens/Settlements/Settlements(1).png` and `Settlements(2).png`:

- The Settlements register is not the older four-KPI worklist page from `SETTLEMENTS_AND_CALC_ENGINE.md`
- The screenshot-backed page uses the title `Settlement & Reconciliation` and a two-button action row with `Export` and `Generate Settlement Statement`
- The top summary strip contains seven compact bordered cards:
  - `Total Pending`
  - `Pending Reconciliation`
  - `Pending Approval`
  - `High Variance`
  - `Compliance Hold`
  - `Total Payable`
  - `Overdue`
- The page includes a three-panel chart row:
  - `Expected vs Actual (M)`
  - `Variance % by Cedant`
  - `Cedant Settlement Exposure (M)`
- The worklist toolbar is compact and only shows:
  - search
  - status dropdown
  - list/grid view toggle
- The table columns are:
  - `Settlement`
  - `Cedant / Contract`
  - `Period`
  - `Expected`
  - `Actual`
  - `Variance`
  - `IRiS`
  - `Status`
  - `Open`
- The screenshot row set is the source of truth for the seeded mock register:
  - `Northstar Pension Trust`
  - `Helvetia Retirement Fund`
  - `Maple Leaf Pension Plan`
  - `Bavarian Industrial Fund`
  - `Atlas Corporate Pensions`
- Stale smoke-test settlement overrides and created rows that conflict with the screenshot-backed register should be cleared rather than treated as permanent design truth

---

## CORRECT CONTRACT NAV (from screenshots)

The left nav has TWO groups: **Master Data** (8 tabs) and **Operations** (6 tabs lettered A–F):

```
Master Data
  01 Master Data
  02 Economic Terms
  03 Reference Pool
  04 Actuarial Basis
  05 Risk & Limits
  06 Operational Terms
  07 Compliance & Docs
  08 Audit & Approval

Operations
  A  Details & Performance
  B  Member List
  C  File Templates
  D  Amendments
  E  Calculations
  F  Audit & Compliance
```

---

## 04 ACTUARIAL BASIS (exact from screenshot)

**Section subtitle:** "Mortality, discount and assumption versioning."

Fields (3-column grid):
```
[Mortality Table ID: CMI-2024-M]           [Mortality Table Name: CMI 2024 with 1.5% LTR]
[Mortality Improvement Scale (textarea — full width)]
[Discount Curve ID: YC-GBP]               [Discount Curve Source: Bloomberg]    [Inflation Assumption: CPI 2.4%]
[Longevity Loading (%): 1.5]              [Expense Loading (%): 0.4]             [Assumption Set ID: AS-LSC-2024-019]
[Last Revaluation: 01/15/2025]            [Next Revaluation Due: 01/15/2026]
```

---

## 05 RISK & LIMITS (exact from screenshot)

**Section subtitle:** "Caps, triggers and termination events."

Fields:
```
[Max Loss Limit: 187500000]        [Aggregate Limit: 375000000]       [Deductible: 6250000]
[Catastrophe Cap: 250000000]       [Rating Downgrade Trigger: < A-]   [☑ Risk Committee Approval Required]
[Early Termination Event (textarea — full width)]
[Novation Rights (textarea — full width)]
[Cedant Change of Control (textarea — full width, below fold)]
```

---

## 06 OPERATIONAL TERMS (exact from screenshot)

**Section subtitle:** "Settlement calendar, file formats and key contacts."

Fields (3-column grid):
```
[Settlement Calendar: London]       [Cession File Format: CSV ▾]        [Cession File Frequency: Quarterly ▾]
[SFTP Endpoint ID: sftp-lsc-2024-019] [Encryption Method: PGP]         [Reporting Package: Standard quarterly pack]
[Lead Underwriter: m.patel@reinsure.io] [Operations Contact: a.chen@reinsure.io] [Legal Contact: legal@reinsure.io]
```

---

## 03 REFERENCE POOL (exact from screenshot)

**Section subtitle:** "Population covered by the longevity swap."

Fields:
```
[Pool Name: Northstar Pension Trust Refere...]   [Lives Covered: 18420]    [Average Age: 71]
[Male/Female Split: 55/45]                        [Average Pension Amount: 24500]  [Pool Currency: GBP]
helper text: "e.g. 55/45"
[Geographic Concentration: UK 92% / EU 6% / RoW 2%]   [Benefit Type: Defined Benefit ▾]   [Indexation Basis: CPI capped 5%]
[Closed / Open: Closed ▾]                              [Data As Of: 01/15/2024]             [Data Source Reference: ]
```

---

## SECTION A: DETAILS & PERFORMANCE (exact from screenshots)

### Top KPI Strip (5 cards, full width)
```
[Notional: £1,250,000,000]   [Fixed Leg: 2.85% Quarterly]   [Lives Covered: 18,420]   [Renewal Date: 2025-01-15 (-475 days) ← RED bg]   [A/E Mortality: 102.0% (1127/1105 deaths)]
```

Note: Renewal Date card has **pink/red background** when past due.

### Master Data Summary (3-column cards below KPI strip)
Three summary cards side by side:

**Identification card:**
```
Contract ID    LSC-2024-019
Cedant         CED-1057 — N...
Swap Type      Indemnity
Structure      Single tranche
Inception      2024-01-15
Maturity       2054-01-15
Duration       30 yrs
Version        v1.2
Governing Law  English Law
```

**Economic Terms card:**
```
Notional       £1,250,000,000
Fixed Leg      2.85% ACT/365
Floating Leg   Realized mortality
Payment Lag    30 days
Settlement Ccy GBP
Collateral     Threshold £25,...
```

**Reference Pool card:**
```
Pool Name      Northstar Pensi...
Lives          18,420
Avg Age        71
M/F Split      55/45
Avg Pension    £24,500
Indexation     CPI capped 5%
Status         Closed
```

Below — second row of 3 summary cards:

**Actuarial Basis card:**
```
Mortality Table    CMI 2024 with ...
Improvement Scale  —
Discount Curve     YC-GBP (Bloo...
Inflation          CPI 2.4%
Longevity Loading  1.5%
Last Reval         2025-01-15
Next Reval         2026-01-15
```

**Risk & Limits card:**
```
Max Loss     £187,500,000
Aggregate    £375,000,000
Deductible   £6,250,000
Cat Cap      £250,000,000
```

**Operational card:**
```
SFTP        sftp-lsc-2024-019
Format      CSV
Frequency   Quarterly
Calendar    London
Underwriter m.patel@reinsu...
Operations  a.chen@reinsur...
```

### Pensioners — Actual vs Expected Table
**Title:** "Pensioners — Actual vs Expected"  
**Subtitle:** "Cumulative net variance: £1,205,839"

Columns: Quarter | Expected Deaths | Actual Deaths | A/E | Fixed Leg | Floating Leg | Net Settled | Active Pensioners

```
Q1 2024 | 221 | 239 | 108.1% (red)  | £8,906,250 | £9,511,369 | +£605,119 (green) | 18,397
Q2 2024 | 221 | 209 |  94.6% (grey) | £8,906,250 | £8,695,801 |  -£210,449 (red)  | 18,345
Q3 2024 | 221 | 216 |  97.7% (grey) | £8,906,250 | £8,890,982 |   -£15,268 (red)  | 18,264
Q4 2024 | 221 | 222 | 100.5%        | £8,906,250 | £9,064,058 |  +£157,808 (green)| 18,193
```

A/E coloring: >100% = red, <100% = grey/muted  
Net Settled coloring: positive = green (reinsurer pays cedant), negative = red (cedant pays reinsurer)

---

## SECTION C: FILE TEMPLATES (exact from screenshots)

**Header:** "6 agreed file template(s) for ongoing data exchange." + [+ Add Template] button

Each template displayed as a **card** (2-column grid of cards):

**Card format:**
```
┌─────────────────────────────────────────────────────────┐
│ 📄 [Template Name]                              [CSV]   │
│ LSC-2024-031-T1 · schema v2.1                          │
│                                                         │
│ Frequency      Quarterly                               │
│ Channel        sftp-lsc-2024-031                       │
│ Last Received  2025-03-31                              │
│ Columns        8                                        │
│                                                         │
│ Schema Columns                                          │
│ [member_id] [dob] [gender] [annuity_amount] [currency] │
│ [status] [last_payment_date] [indexation_basis]        │
│                                                         │
│ [⬇ Download]  [↑ Upload Sample]                        │
└─────────────────────────────────────────────────────────┘
```

**6 template types visible in screenshots:**
1. **Pensioner Parameters** — T1 · schema v2.1 · CSV · Quarterly
   - Columns: member_id, dob, gender, annuity_amount, currency, status, last_payment_date, indexation_basis
2. **Spouse / Beneficiary Events** — T2 · schema v1.4 · CSV · Monthly
   - Columns: member_id, event_type, event_date, spouse_dob, spouse_gender, benefit_pct
3. **Fixed Fee Amounts** — T3 · schema v1.0 · XLSX · Quarterly
   - Columns: period, fee_amount, currency, due_date
4. **Fixed Leg Schedule** — T4 · schema v1.2 · CSV · Quarterly
   - Columns: payment_date, notional, rate, amount, currency
5. **Demographic Assumptions** — T5 · schema v3.0 · XLSX · Annual
   - Columns: age, gender, qx, improvement_rate, ltr
6. **Mortality Experience** — T6 · schema v2.0 · CSV · Quarterly
   - Columns: member_id, death_date, cause_code, verified_by, verified_date

Schema column tags styled as: `background: #F0F2F5 / border-radius: 4px / padding: 2px 6px / font-size: 11px / font-family: monospace`

---

## SECTION D: AMENDMENTS (exact from screenshot)

Header: "0 amendment(s) recorded for LSC-2024-031."
Button: [+ Add Amendment] (primary dark)

**Empty state table:**
```
ID | Version | Type | Summary | Submitted | Effective | Status
(No amendments yet — click Add Amendment to draft one.)
```

**Add Amendment Modal (triggered by button):**
Columns: ID (auto), Version (auto-incremented), Type (dropdown: Notional / Rate / Pool / Operational / Other), Summary (text), Submitted (date), Effective (date), Status (Draft → Pending Approval → Approved)

---

## SECTION E: CALCULATIONS (exact from screenshot — Helvetia example)

Same as Calculation Engine page but scoped to this contract.

**Aggregation Calculator header:**
"Run aggregations on this contract's quarterly performance."

Fields in a row:
```
[Metric: Settlement Variance ▾]  [Aggregation: Sum ▾]  [Group By: Per Quarter ▾]  [From: Q1 2024 ▾]  [To: Q1 2025 ▾]
```

**Result display box:**
```
SUM of settlements · 5 quarter(s)                    Currency: CHF / Q1 2024 → Q1 2025

CHF  474,031
```

**Breakdown table below:**
```
Quarter    | settlements
Q1 2024    | CHF 182,642
Q2 2024    | CHF  94,200
Q3 2024    | CHF  78,900
Q4 2024    | CHF  61,800
Q1 2025    | CHF  56,489
```

---

## CESSION FILE PIPELINE — EXACT CORRECTIONS

### Step 3 (Map Contract) — exact from screenshot

**Title:** "Contract & Treaty Mapping"  
**Subtitle:** "Auto-mapped by cedant + period. Override below if required."

Three fields in a row:
```
[Contract: LSC-2025-002 (v1.0) ▾]    [Version: v1.0]    [Period: 2025 Q1]
```

**Contract metrics card (below dropdowns):**
```
Notional        EUR 1120M
Fixed leg       2.55%
Floating leg    Realized mortality
Lives covered   15,680
Inception       2025-02-01
Maturity        2055-02-01
Status          Active
Currency        EUR
```

### Step 4 (Clauses) — exact from screenshot

**Title:** "Applicable Contract Clauses"  
**Subtitle:** "2 clauses identified for Fixed Leg."

**Table columns:** Ref | Clause | Category | Description | Active
```
§6.2 | Fixed Leg Calculation | Calculation | Fixed leg = Notional × FixedRate × DayCount(ACT/365). | ✓ (green circle)
§6.4 | Fee Schedule          | Calculation | Quarterly fee per agreed schedule; deviation > 0.5% triggers review. | ✓ (green circle)
```

### Step 6 (Exceptions) — exact from screenshot

**Title:** "Exception Handling"  
**Subtitle:** "6 unresolved · IRiS suggestions available · every action audited"

**Table format (NOT one-at-a-time — show full table):**
Columns: Sev | Row | Field | Issue | Current | AI suggestion | Action

```
[Critical] 100 | fixed_leg_amount | Variance vs contract calc > 1.5% | 8,914,200 | 8,782,055 (per §6.2 ACT/365) conf 97% | [Accept] [Override] [Manual]
[Warning]  237 | fee_amount       | Quarterly fee outside schedule by 0.7% | 412,300 | 409,400 conf 90% | [Accept] [Override] [Manual]
[Info]     374 | value_date       | Settlement date is non-business day | 2025-03-30 | 2025-03-31 (next business day) conf 99% | [Accept] [Override] [Manual]
[Critical] 511 | fixed_leg_amount | Variance vs contract calc > 1.5% | 8,914,200 | 8,782,055 (per §6.2 ACT/365) conf 97% | [Accept] [Override] [Manual]
[Warning]  648 | fee_amount       | Quarterly fee outside schedule by 0.7% | 412,300 | 409,400 conf 90% | [Accept] [Override] [Manual]
[Info]     785 | value_date       | Settlement date is non-business day | 2025-03-30 | 2025-03-31 conf 99% | [Accept] [Override] [Manual]
```

Action buttons inline:
- **Accept** → teal text, applies AI suggestion
- **Override** → blue text, opens inline edit input
- **Manual** → grey text, marks for manual resolution

### Step 7 (Process) — exact from screenshot

**Title:** "Processing — Fixed Leg"  
**Subtitle:** "Click Continue to execute. Engine logic depends on file type."

**Engine plan card (grey border):**
```
Engine plan
• Recompute fixed leg per §6.2 (ACT/365)
• Compare to file values
• Flag deviations > tolerance
```

**IRiS AI card (light teal border, sparkle icon):**
```
✦ IRiS will compute before/after population, financial impact and anomaly detection on the next step.
```

No progress bar at this step — user clicks Continue to trigger processing.

### Step 8 (Summary) — exact from screenshot

**Title:** "Processing Summary"  
**Subtitle:** "Business impact, exceptions, IRiS insights"

**Two KPI cards side by side:**
```
┌──────────────────────┐   ┌──────────────────────────────────────┐
│ Liability Impact     │   │ Fixed Leg Recomputed  (teal border)  │
│ €0                   │   │ +€8.78M                              │
└──────────────────────┘   └──────────────────────────────────────┘
```

**IRiS Insights card (sparkle icon):**
```
✦ IRiS Insights
recommendation: 1 cell deviates from §6.2 calc by 1.5% — accept AI correction.
```

**Action buttons row (below):**
```
[✓ Approve (green)]  [↺ Reprocess]  [Rollback]  [✈ Escalate]
```

### Step 9 (Worklist) — exact from screenshot

**Title:** "Worklist Tasks Created"  
**Subtitle:** "Routed to owning teams with SLA"

**Table columns:** Task | Type | Team | Priority | SLA

```
Resolve 2 critical validation errors    | Validation | Claims Ops | [High] | 2h
WL-CES-2025-09-015-VAL
```

### Step 10 (Audit) — exact from screenshot

**Title:** "Audit Trail"  
**Subtitle:** "4 events captured"

**Table columns:** Timestamp | Actor | Type | Action | Detail

```
2026-05-05 01:12:48 | SFTP Listener       | System   | File received via SFTP              | —
2026-05-05 01:12:48 | AI Classifier v3.2  | AI Agent | Classified as "Fixed Leg"           | confidence 94%
2026-05-05 01:12:48 | AI Classifier v3.2  | AI Agent | Identified cedant Bavarian Industrial Fund | confidence 99%
2026-05-05 01:12:48 | Pipeline Orchestrator| System  | Mapped to LSC-2025-002 v1.0         | —
```

Final button: **[Finish]** (replaces Continue) → closes modal, returns to file queue list.

---

## UPLOAD OPTION — Two Paths (from UploadCedentFile2.png)

The Upload step has TWO options displayed as cards side by side:

```
┌─────────────────────────────────────────┐  ┌────────────────────────────────────────┐
│ ✦ Option A — AI Auto-Detect             │  │ 📄 Option B — Manual Type              │
│ IRiS classifies file type and identifies│  │ [Choose file type...        ▾]         │
│ cedant from filename, columns and       │  │                                        │
│ metadata.                               │  │ [Upload with Type (disabled)]          │
│                                         │  │                                        │
│ [Upload & Auto-Detect]                  │  │                                        │
└─────────────────────────────────────────┘  └────────────────────────────────────────┘
```

Option A is the primary (button is filled/active).  
Option B manual type dropdown options: Pension Status | Fixed Leg | Mortality Report | Spouse Events | Activity Report | Fee Schedule | etc.

---

## CEDENT PENSION SCHEME TAB (exact from screenshot)

**Section header:** "Pension Scheme Information"

Fields:
```
[Scheme ID: PS-1042]              [Scheme Name *: Northstar Pension Trust Defined...]   [Scheme Type: Defined Benefit ▾]
[Trustee Name: Northstar Pension Trust Trustee]  [Scheme Registration Number: REG-1042]  [Scheme Country: UK]
[Scheme Currency: GBP ▾]          [Benefit Type: Final Salary ▾]                         [Retirement Age Rules: Normal Retirement Age 65]
[Indexation Rules (textarea — full width): "CPI capped at 5%"]
[Spouse Benefits (textarea): "50% spousal pension"]  [Guaranteed Period Rules (textarea): "5-year guarantee"]  [Deferred Member Rules (textarea): "Revaluation per statutory order"]
```

---

## CEDENT KEY CONTACTS TAB (exact from screenshot)

Shows multiple contact cards stacked vertically. Each card:

**Card header:** "[Category] — [Full Name]" (e.g. "Executive Sponsor — Alex Morgan")

Fields per card:
```
[Category: Executive Sponsor ▾]    [Full Name: Alex Morgan]    [Designation: Chief Executive Officer]
[Department: ]                     [Email: exec@northstarpensiontrust.co...]  [Phone: ]
[Mobile: ]                         [Preferred Contact: Email ▾]              [Language: English ▾]
```

Second contact card: "Underwriting Contact — Sam Reeves"
```
[Category: Underwriting Contact]  [Full Name: Sam Reeves]  [Designation: Head of Risk]
[Department: ]  [Email: underwriting@northstarpension...]  [Phone: ]
```

[+ Add Contact] button at bottom.

---

## COMPLIANCE DASHBOARD ADDITIONAL DETAIL (from graphs screenshot)

### Audit Risk Heatmap Panel
Shows below the 3 graphs. Header: "Audit Risk Heatmap" + "open exceptions" pill right.

Table:
```
Area          | Low | Medium | High
Underwriting  |  2  |   1    |  —
Cession       |  4  |   2    |  1
Settlement    |  1  |   2    |  1
Compliance    |  3  |   —    |  —
Admin         |  1  |   1    |  —
```

### Active Screening Hits Panel
Header: "Active Screening Hits" + "Open →" link right.
```
Sergei V. Markov     [Escalated]
OFAC SDN · conf 0.88

John A. Whitcomb     [Pending Review]
FinCEN 314(a) · conf 0.71

Atlas Corporate Pensions  [Under Review]
OFAC SDN · conf 0.42
```

---

## UNDERWRITER DASHBOARD ADDITIONAL GRAPHS

From `Underwriter_Dashboard_Graphs.png`:

**Graph 4: Population Movement (000s)** — Area/line chart
- X: Nov → Apr (6 months)
- Y: 590–617 (thousands)
- Single area fill line going from ~590 Nov to ~617 Apr
- Shows steady population growth

**Graph 5: Renewal Pipeline** — Grouped bar chart
- X: 0–30d, 31–60d, 61–90d, 91–180d
- Two series: contracts (light teal) and notional (dark navy)
- Values roughly: 0-30d: 0.75/0.75, 31-60d: 0.75/0.8, 61-90d: 2/1.4, 91-180d: 3/2.3

**High-Risk Cedants panel** (right of graph 5):
Header: "High-Risk Cedants" + "View all →"
```
Atlas Corporate Pensions   [Critical]
OFAC review

Bavarian Industrial Fund   [Review]
Mortality variance > 15%

Northstar Pension Trust    [Review]
Concentration risk
```

**Contract Status Distribution donut legend (from screenshot):**
- Active (navy)
- Pending (light blue)
- Amendment (amber/orange)
- Renewal (green)
- Draft (red)

---

## OPERATIONS DASHBOARD ADDITIONAL GRAPHS

From `Operations_Dashboard_Graphs.png`:

**Graph 1: File Processing Pipeline** — Bar chart
- X: Validation, Cleansing, Output
- Values: Validation ~24, Cleansing ~7, (gap), Output ~19

**Graph 2: Reconciliation Exception Trend** — Dual line chart
- X: Nov–Apr
- breaks line (red): starts ~15, dips to 8, rises to 16, drops to ~11
- resolved line (green): starts ~12, dips to 9, rises to 14, stays ~8

**Graph 3: Settlement Approval Status** — Donut
- Approved (navy), Awaiting Approval (light blue), Reconciling (amber), Disputed (green)

**Graph 4: Cedant File Delivery (30d)** — Grouped bar
- Cedants: Northstar, Helvetia, Maple Leaf, Atlas
- on-time (green) vs late (red) bars
- Atlas has significant late proportion

**High-Impact Exceptions panel:**
Header: "High-Impact Exceptions" + "Open →"
```
EXC-4421   $0.4M
Unmapped fields × 12 — Helvetia

EXC-4422   CAD 540K
Recon break > tolerance — Maple Leaf

EXC-4423   —
Late SFTP delivery — Atlas
```
---

## POPULATION UPLOAD MODAL CORRECTION

From `Population_UploadCedentFile.png`:

- The Population page upload action opens an in-page modal titled `Upload Pensioner CSV`
- The modal must ask for both `Cedant` and `Contract` before upload
- The contract selector is cascade-driven and stays disabled with `Select cedant first` until a cedant is chosen
- Both dropdowns are populated from existing cedants and contracts instead of using a free-text handoff field
- The modal includes a CSV file picker plus `Cancel` and `Upload` actions instead of a redirect-only stub
- User change on 2026-05-07 widened the live uploader to accept Excel (`.xlsx`) files as well, so the implemented modal copy now references `Upload Pensioner File` / `CSV or Excel File` even though the screenshot labels say CSV
