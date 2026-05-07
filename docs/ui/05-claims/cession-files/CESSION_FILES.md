# IRiS — Cession File Processing

**Route:** `/claims/cession-files`  
**File:** `src/pages/claims/cession/CessionFilesPage.tsx`  
**Auth:** `claims_ops`, `super_admin`

---

# CESSION FILES LIST PAGE

## Layout
```
Home › Claims Ops › Cession Files

Cedant File Processing                              [↑ Upload File]
End-to-end ingestion, classification, validation, clause-driven processing & audit

[In Pipeline: 6 / awaiting]  [Exceptions: 4 / critical errors]  [Processed: 2 / approved]  [STP: 94.2%]

Pipeline Throughput (24h)
[18,976 Records ingested]  [7 Files]  [4 In exception]  [2h 14m Avg processing time]

File Queue                             [All types ▾]   [All] [Exceptions] [Review] [Approved]

┌────────────┬────────────────────────────────┬──────────────────────┬────────────────┬─────────────┬─────────┬───────────┬──────────┬────────────┐
│ File ID    │ Filename                       │ Cedant               │ Type           │ Contract    │ Records │ Stage     │ Critical │ Received   │
├────────────┼────────────────────────────────┼──────────────────────┼────────────────┼─────────────┼─────────┼───────────┼──────────┼────────────┤
│CES-2025-015│northstar_status_2025.csv       │Northstar Pension     │Pension Status  │LSC-2024-019 │ 18,420  │Validated  │ 2        │2026-05-05  │
│CES-2025-016│helvetia_mortality_apr2025.xlsx │Helvetia Retirement   │Mortality Report│LSC-2024-031 │  3,200  │Processing │ 0        │2026-05-05  │
│CES-2025-017│maple_activity_2025Q1.csv       │Maple Leaf Pension    │Activity Report │LSC-2024-044 │  1,850  │Exceptions │ 4        │2026-05-04  │
│CES-2025-018│bavarian_fixed_leg_q1.csv       │Bavarian Industrial   │Fixed Leg       │LSC-2025-002 │      4  │Approved   │ 0        │2026-05-03  │
└────────────┴────────────────────────────────┴──────────────────────┴────────────────┴─────────────┴─────────┴───────────┴──────────┴────────────┘
```

**Stage badges:**
- Uploaded: grey
- Detecting/Mapping/Validating: blue + pulsing dot
- Validated: teal
- Exceptions: red
- Processing: blue
- Processed/Approved: green
- Rejected: red

**Row click:** Opens `<FileProcessingModal>` for that file  
**[↑ Upload File] button:** Opens upload step of `<FileProcessingModal>` (new file)

---

# FILE PROCESSING MODAL (10-Step Pipeline)

**File:** `src/pages/claims/cession/FileProcessingModal.tsx`  
**Type:** Full-screen modal with horizontal step bar

## Modal Header
```
New Cession File                                                              [Approved badge]  [×]
Upload + AI-assisted ingestion pipeline
(or: CES-2025-09-015 · bavarian_fixed_leg_q1.csv · Bavarian Industrial Fund · Fixed Leg · 4 records)
```

## Step Bar (horizontal, top of modal)
```
[Upload ✓] → [Detect ✓] → [Map Contract ✓] → [Clauses ✓] → [Validate ●] → [Exceptions] → [Process] → [Summary] → [Worklist] → [Audit]
```

---

## Step 1: Upload

```
Upload Cedant File
Manual or SFTP-staged. Choose AI auto-detection or pick file type explicitly.

┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        [↑ upload icon]                             │
│                                                                     │
│               Drop file here, or pick a sample below               │
│                                                                     │
│               [filename.csv input field]                           │
│                                                                     │
│  [northstar_status_2025Q1.csv]  [helvetia_mortality_apr2025.xlsx]  │
│  [northstar_spouses_apr.csv]    [maple_activity_2025Q1.csv]        │
│  [bavarian_fixed_leg_q1.csv]    [boe_discount_curve_2025Q1.csv]    │
│  [northstar_collateral_apr.csv]                                    │
└─────────────────────────────────────────────────────────────────────┘
```

Sample files are clickable (POC demo files).  
After file selection: shows filename + size + [Continue →]

**API call:** `POST /api/v1/claims/cession-files/upload` (multipart)

---

## Step 2: Detect

```
AI Classification & Cedant Identification
Review and override IRiS detection if needed.

┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│ File Type                            │  │ Cedant                               │
│                                      │  │                                      │
│ Fixed Leg              94% confidence│  │ Bavarian Industrial Fund 99% confidence│
│                                      │  │                                      │
│ Override: [Fixed Leg            ▾]   │  │ Override: [Bavarian Industrial Fund ▾]│
└──────────────────────────────────────┘  └──────────────────────────────────────┘

✦ IRiS reasoning
Filename token match (bavarian_fixed_leg_q1.csv) + column signature + cedant SFTP key matched.
No ambiguity flags raised.
```

Override dropdowns let user correct AI detection.  
[Continue →] proceeds to next step.

**API call:** `POST /api/v1/claims/cession-files/{file_id}/pipeline/detect`

---

## Step 3: Map Contract

```
Contract Mapping
IRiS has matched this file to the following contract.

┌────────────────────────────────────────────────────────────────────────────────┐
│ Matched Contract                                                               │
│                                                                                │
│ LSC-2025-002 — Bavarian Industrial Fund Longevity Swap 2025      99% confidence│
│ EUR 1,120M · 15,680 lives · Inception 2025-02-01                              │
│                                                                                │
│ Matching basis: Cedant CED-1201 + File Type "Fixed Leg" + Period Q1 2025      │
└────────────────────────────────────────────────────────────────────────────────┘

Contract Metrics (from matched contract):
[Fixed Rate: 2.55%]  [Period: Q1 2025]  [Expected Fixed Leg: EUR 8,782,055]

Override contract: [Select contract ▾]
```

---

## Step 4: Clauses

```
Contract Clause Verification
Relevant clauses extracted from LSC-2025-002 for this file type.

┌──────────────────────────────────────────────────────────────────────────────────┐
│ § 6.2  Fixed Leg Calculation Basis                    ⚠ Check Required         │
│ ACT/365 basis — fixed amount must be within 1.5% of schedule amount             │
│ Fields affected: fixed_leg_amount                                               │
├──────────────────────────────────────────────────────────────────────────────────┤
│ § 8.1  Settlement Currency                            ✓ Matched                │
│ All fixed leg payments in EUR unless FX conversion triggered                    │
│ Fields affected: currency                                                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ § 3.4  Payment Date Convention                        ✓ Matched                │
│ Settlement on next business day if period end falls on weekend                  │
│ Fields affected: value_date                                                     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 5: Validate

```
Data Validation Results
4 records · 32 columns auto-mapped

[Records: 4]  [Critical errors: 2]  [Warnings: 2]  [Informational: 2]

┌──────────┬─────┬──────────────────────┬───────────────────────────────────┬─────────────────┬────────────────────────────────┐
│ Sev      │ Row │ Field                │ Issue                             │ Current         │ AI Suggestion                  │
├──────────┼─────┼──────────────────────┼───────────────────────────────────┼─────────────────┼────────────────────────────────┤
│ Critical │ 100 │ fixed_leg_amount     │ Variance vs contract calc > 1.5%  │ 8,914,200       │ 8,782,055 (per §6.2 ACT/365) conf 97%│
│ Warning  │ 237 │ fee_amount           │ Quarterly fee outside schedule 0.7%│ 412,300        │ 409,400 conf 90%               │
│ Info     │ 374 │ value_date           │ Settlement date is non-business day│ 2025-03-30     │ 2025-03-31 (next business day) conf 99%│
│ Critical │ 511 │ fixed_leg_amount     │ Variance vs contract calc > 1.5%  │ 8,914,200       │ 8,782,055 (per §6.2 ACT/365) conf 97%│
└──────────┴─────┴──────────────────────┴───────────────────────────────────┴─────────────────┴────────────────────────────────┘
```

**Severity colors:**
- Critical: red badge `#E74C3C`
- Warning: amber badge `#F39C12`
- Info: blue badge `#3498DB`

**AI suggestion:** Shown in muted text with confidence %. Clickable "Apply AI suggestion" per row.

---

## Step 6: Exceptions

```
Exception Resolution
Review and resolve all flagged items before processing.

[2 Critical] [2 Warnings] [2 Informational]

Exception 1 of 6
┌──────────────────────────────────────────────────────────────────────────────┐
│ [CRITICAL] Row 100 · fixed_leg_amount                                        │
│                                                                              │
│ Issue: Variance vs contract calc > 1.5%                                     │
│ Current value: 8,914,200                                                    │
│ AI suggestion: 8,782,055 (per §6.2 ACT/365) — 97% confidence               │
│                                                                              │
│ Resolution:                                                                  │
│ ○ Accept AI suggestion (8,782,055)                                          │
│ ○ Override with manual value: [__________]                                  │
│ ○ Reject (flag for re-submission)                                            │
└──────────────────────────────────────────────────────────────────────────────┘
[← Previous]  [Next →]

[Resolve All Critical with AI suggestions]
```

---

## Step 7: Process

```
Processing
IRiS is applying all validated and resolved data...

[████████████████████░░░░]  78%

✓ Record normalization complete (4 records)
✓ Fixed leg amounts updated
✓ Clause validations passed
⏳ Updating settlement schedule...
```

Progress bar with live steps. Streams via polling `GET /api/v1/claims/cession-files/{id}/pipeline-status`.

---

## Step 8: Summary

```
Processing Summary
CES-2025-09-015 · bavarian_fixed_leg_q1.csv

[Records Processed: 4]  [Exceptions Resolved: 2]  [Exceptions Overridden: 0]

Settlement Impact
┌─────────────────────────────────────────────────────────────────────┐
│ Settlement ID Created: SET-2025-Q1-002                              │
│ Fixed Leg Adjustment: -EUR 132,145                                  │
│ Net Settlement (Q1 2025): EUR 8,649,910                             │
│ → Proceeds to approval workflow                                     │
└─────────────────────────────────────────────────────────────────────┘

Population Changes: None (Fixed Leg file — no population updates)

[1 Worklist item created: Settlement approval pending — SET-2025-Q1-002]
```

---

## Step 9: Worklist

```
Worklist Items Created
Tasks generated from this processing run.

┌──────────────────────────────────────────────────────────────────────┐
│ [High]  WL-9301                                      [↗ Open]       │
│ Settlement approval required — SET-2025-Q1-002                      │
│ Bavarian Industrial Fund · Q1 2025 · EUR 8,649,910                  │
│ Assign to: Claims Ops                                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Step 10: Audit

```
Audit Trail
Full processing log for CES-2025-09-015

┌─────────────────────────────────────────────────────────────────────┐
│ 2026-05-05 09:00:12  File received via manual upload                │
│ 2026-05-05 09:01:03  AI detection: Fixed Leg (94%) · Bavarian (99%)│
│ 2026-05-05 09:01:45  Contract mapped: LSC-2025-002                 │
│ 2026-05-05 09:02:10  Clauses checked: 3 (1 flagged)               │
│ 2026-05-05 09:02:58  Validation: 2 critical, 2 warnings            │
│ 2026-05-05 09:15:22  Exceptions resolved: 2 accepted               │
│ 2026-05-05 09:16:01  Processing complete                            │
│ 2026-05-05 09:16:05  Settlement SET-2025-Q1-002 created            │
│ 2026-05-05 09:16:06  Worklist WL-9301 created                      │
└─────────────────────────────────────────────────────────────────────┘

[Export Audit PDF]    [Close]
```

---

# SETTLEMENTS PAGE

**Route:** `/claims/settlements`  
**File:** `src/pages/claims/settlements/SettlementsPage.tsx`

## Layout
```
Home › Claims & Settlement › Settlements

Settlements

[Pending: 8 / $42.1M]  [Approved: 12]  [Paid YTD: 24]  [Disputes: 2]

[Settlement graph — approval status donut + timeline bar]

Settlement Worklist
┌─────────────────┬──────────────────────┬───────┬───────────────┬────────────┬──────────────────┬───────┬─────────────────┐
│ Settlement ID   │ Cedant               │Period │ Net Amount    │ Direction  │ Due Date         │Status │ Actions         │
├─────────────────┼──────────────────────┼───────┼───────────────┼────────────┼──────────────────┼───────┼─────────────────┤
│SET-2025-Q1-019  │Northstar Pension Trust│Q1 2025│+GBP 183,000  │Reinsr→Cedt │2025-04-30       │Pending│[View] [Approve] │
│SET-2025-Q1-031  │Helvetia Retirement   │Q1 2025│+CHF 94,200   │Reinsr→Cedt │2025-04-30       │Pending│[View] [Approve] │
│SET-2025-Q1-002  │Bavarian Industrial   │Q1 2025│-EUR 8,649,910│Cedt→Reinsr │2025-05-01       │Pending│[View] [Approve] │
└─────────────────┴──────────────────────┴───────┴───────────────┴────────────┴──────────────────┴───────┴─────────────────┘
```

All data mock. Clicking [View] opens detail panel. [Approve] triggers approval workflow.

---

# CALCULATION ENGINE PAGE

**Route:** `/claims/calculation-engine`  
**File:** `src/pages/claims/calculation/CalcEnginePage.tsx`

## Layout
```
Home › Claims & Settlement › Calculation Engine

Calculation Engine

[Select Contract ▾]   [Calculation Type ▾]   [Period From ▾]   [Period To ▾]   [Run Calculation]

Result Panel (after run):
┌─────────────────────────────────────────────────────────────────┐
│ LSC-2024-019 · Q1 2025                                         │
│                                                                 │
│ Fixed Leg:       GBP  8,420,000                                │
│ Floating Leg:    GBP  8,603,000                                │
│ Net Settlement:  GBP    183,000  → Reinsurer pays Cedant        │
│ A/E Ratio:       1.018                                         │
│ BEL (current):   GBP 892,000,000                               │
│ Lives (start):   18,420                                         │
│ Deaths (actual): 42                                             │
│ Deaths (expected): 41.2                                        │
└─────────────────────────────────────────────────────────────────┘

[Export to Settlement]  [Save Calculation]
```
