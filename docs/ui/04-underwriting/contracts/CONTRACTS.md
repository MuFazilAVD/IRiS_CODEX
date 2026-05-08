# IRiS — Contracts Pages

---

# CONTRACTS LIST PAGE

**Route:** `/underwriting/contracts`  
**File:** `src/pages/underwriting/contracts/ContractsPage.tsx`

## Layout
```
Home › Underwriting › Contracts

Contracts                                         [+ New Contract]
Longevity reinsurance contracts: terms, versioning, amendments

5 contracts
┌──────────┬─────────────────────────┬──────────┬──────┬──────────┬────────────┬────────────┬────────┬────────┬────────┬─────────────────────┐
│ ID       │ Cedant                  │ Notional │Fixed │ Floating │ Inception  │ Maturity   │ Lives  │Version │ Status │ Actions             │
├──────────┼─────────────────────────┼──────────┼──────┼──────────┼────────────┼────────────┼────────┼────────┼────────┼─────────────────────┤
│LSC-2024-019│Northstar Pension Trust│GBP 1250M │ 2.85%│Realized  │ 2024-01-15 │ 2054-01-15 │ 18,420 │ v1.2   │Active  │[View][Members][Amend]│
│LSC-2024-031│Helvetia Retirement Fd │CHF 870M  │ 2.1% │Realized  │ 2024-03-01 │ 2049-03-01 │ 12,150 │ v1.0   │Active  │[View][Members][Amend]│
│LSC-2024-044│Maple Leaf Pension Plan│CAD 540M  │ 3.05%│Realized  │ 2024-06-12 │ 2059-06-12 │  8,900 │ v1.1   │Active  │[View][Members][Amend]│
│LSC-2025-002│Bavarian Industrial Fd │EUR 1120M │ 2.55%│Realized  │ 2025-02-01 │ 2055-02-01 │ 15,680 │ v1.0   │Active  │[View][Members][Amend]│
│LSC-2025-009│Atlas Corporate Pensions│USD 380M │ 3.20%│Realized  │ 2025-04-01 │ 2060-04-01 │  6,200 │ v1.0   │Draft   │[View][Members][Amend]│
└──────────┴─────────────────────────┴──────────┴──────┴──────────┴────────────┴────────────┴────────┴────────┴────────┴─────────────────────┘
```

Column actions: [View] → navigates to detail | [Members] → population screen filtered | [+ Amend] → amendment modal

---

# CONTRACT DETAIL PAGE

**Route:** `/underwriting/contracts/{contract_id}`  
**File:** `src/pages/underwriting/contracts/ContractDetailPage.tsx`

## Header
```
← Back to Contracts

Helvetia Retirement Fund Longevity Swap 2024              [Active] [Renewal 2025-03-01]
LSC-2024-031 · Helvetia Retirement Fund · CHF 870M · 12,150 lives

[↑ Upload Members]  [+ Add Amendment]  [⚠ Terminate]  [✏ View/Edit]
```

## Layout
`<SectionPanel>` with master data nav + operations nav

### Left Nav
```
Master Data
  01 Master Data          ← default
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
```

---

## Section 01: Master Data

**Sub-section: Contract Identification**
```
[Contract ID: LSC-2024-019]  [Contract Name: Northstar Pension Trust Longev...]  [Contract Version: v1.2]
[Cedant: Northstar Pension Trust ▾]  [Counterparty Role: Reinsurer ▾]  [Parent Contract (if amendment): LSC-2024-019]
[Swap Type: Indemnity ▾]  [Structure: Single tranche ▾]  [Master Agreement Reference: ISDA-LSC-2024-019]
[Inception Date: 01/15/2024]  [Effective Date: 01/15/2024]  [Maturity Date: 01/15/2054]
[Duration (years): 30]  [Governing Law: English Law]  [Jurisdiction: England & Wales]
```

Footer note: "Read-only view. Click Edit to modify."  
[Edit] button top-right → fields become editable inputs.

---

## Section 02: Economic Terms

**Sub-section: Economic Terms**  
Subtitle: "Notional, fixed/floating legs, payment frequencies, settlement and collateral."
```
[Notional Amount *: 1250000000]  [Currency: GBP ▾]  [Settlement Currency: GBP]
[Fixed Leg Rate (%): 2.85]  [Fixed Leg Basis: ACT/365]  [Fixed Leg Frequency: Quarterly ▾]
[Floating Leg Definition: Realized mortality]  [Floating Leg Index/Table: CMI 2024 SAPS]
[Floating Leg Frequency: Quarterly ▾]  [Payment Lag (days): 30]  [FX Reference Source: Bloomberg WMR 4pm]
[☑ Collateral Required]  [Collateral Threshold: 25000000]  [Independent Amount: ]
```

⚠ Note: Fields are locked (read-only) after `is_locked = true` on `contract_economic_terms`. Edit button returns 403.

---

## Section 03: Reference Pool
```
[Pool Name]  [Age Min]  [Age Max]  [Gender Filter: All ▾]
[Inclusion Criteria (textarea)]  [Exclusion Criteria (textarea)]
[Scheme Sections]  [Benefit Types]  [Geographic Scope]
[Lives Count: 18,420]  [Total Notional: 1,250,000,000]  [As of Date: 2024-01-15]
```

---

## Section 04: Actuarial Basis
```
[Base Mortality Table: CMI S3]  [Improvement Model: CMI 2022]  [Base Year: 2022]
[Long Term Rate: 1.50%]  [Initial Rate: 7.00%]  [Convergence Period: 15 years]
[Age Rating Adjustment: 0.00]  [Loading Factor: 0.0380]
[Discount Rate: 3.20%]  [Discount Basis: Gilts + 0.50%]
[Valuation Method: PV of expected cash flows]
[Experience Review Trigger: 5.00%]
[🔒 Locked at inception — 2024-01-15]
```

---

## Section 05: Risk & Limits
```
[Max Notional: 1,500,000,000]
[Mortality Deviation Trigger: 5.00%]
[Settlement Variance Threshold: 1.50%]
[Portfolio Variance Limit: 2,500,000]
[Concentration Limit: 25.00%]
[Recapture Trigger Rating: BB]
```

---

## Section 06: Operational Terms
```
[Cession File Deadline (day of period): 5]
[Cession File Format: CSV]
[Validation Tolerance %: 2.00]
[SLA Validation Days: 3]
[SLA Settlement Days: 10]
[Dispute Resolution (textarea)]
[Administrator Name]  [Administrator Contact]
[SFTP Path: /northstar/inbound/]
```

---

## Section 07: Compliance & Docs
Table of compliance documents:
```
Columns: Type | Name | Date | Status | Actions
[+ Add Document]
```

---

## Section 08: Audit & Approval
Timeline of approvals and changes:
```
2024-01-15  Contract created by Mia W. (Underwriting)
2024-01-15  Actuarial basis locked — Chief Actuary sign-off
2024-03-10  Amendment v1.1 approved — Risk Committee
2024-09-15  Amendment v1.2 approved — Chief Underwriter
```

Approval buttons (if pending): [Approve] [Reject] [Request Changes]

---

## Section A: Details & Performance

Two parts:
1. **Performance Summary** — KPI chips: Current Notional, Active Lives, Deaths YTD, A/E Ratio, BEL, MTM
2. **Settlement History table:**
```
Quarter | Fixed Leg | Floating Leg | Net | Direction | Status
Q1 2024 | £8.42M    | £8.60M       |+£183k|Reinsr→Cedant|Paid
Q2 2024 | £8.38M    | £8.29M       |-£94k |Cedant→Reinsr|Paid
...
```

---

## Section B: Member List
Inline table of population (paginated, 50 per page).  
Columns: Member ID | Age | Gender | Annuity | Status | Last Verified | [Defer] [History]  
Filter: Status (All/Active/Deceased/Deferred)

---

## Section C: File Templates
Table of agreed cession file types for this contract:
```
Columns: File Type | Template Name | Frequency | Required Columns | Sample | Active
```

17 file type rows (Pension Status, Fixed Leg, Mortality Report, etc.)

---

## Amendments Modal
Triggered by `[+ Add Amendment]` button.

```
Add Contract Amendment

[Description: _________________________]
[Changed Sections: (multi-select checkboxes)]
  ☑ Economic Terms   ☐ Risk & Limits   ☐ Operational Terms   ☐ Reference Pool

Changes summary (auto-populated from changed fields)

[Submit for Approval]
```

---

# POPULATION PAGE

**Route:** `/underwriting/population`  
**File:** `src/pages/underwriting/population/PopulationPage.tsx`

## Layout
```
Home › Underwriting › Population

Population Screen                          [↑ Upload cedant file]
Insured lives across active reinsurance contracts

[Northstar Pension Trust ▾]  [LSC-2024-019 ▾]  [Status: all ▾]

14 members
┌────────────────┬─────────────┬─────┬────────┬──────────────┬──────────┬─────────────┬────────────────────┐
│ Member ID      │ Contract    │ Age │ Gender │ Annuity      │ Status   │ Last Verified│ Actions            │
├────────────────┼─────────────┼─────┼────────┼──────────────┼──────────┼─────────────┼────────────────────┤
│ PEN-0100234    │ LSC-2024-019│ 62  │ F      │ GBP 12,000   │ Active   │ 2025-03-31  │ [Defer] [History]  │
│ PEN-0100236    │ LSC-2024-019│ 71  │ F      │ GBP 12,774   │ Active   │ 2025-03-31  │ [Defer] [History]  │
│ PEN-0100238    │ LSC-2024-019│ 78  │ F      │ GBP 13,548   │ Deceased │ 2025-03-31  │ [History]          │
│ PEN-0100240    │ LSC-2024-019│ 84  │ F      │ GBP 14,322   │ Active   │ 2025-03-31  │ [Defer] [History]  │
│ PEN-0100242    │ LSC-2024-019│ 62  │ F      │ GBP 15,096   │ Deferred │ 2025-03-31  │ [History]          │
└────────────────┴─────────────┴─────┴────────┴──────────────┴──────────┴─────────────┴────────────────────┘
```

**Status badge colors:**
- Active: green
- Deceased: dark red/maroon badge
- Deferred: blue-grey
- Suspended: amber

**[History] button:** Opens side drawer with SCD2 history timeline for that member.

**[Upload cedant file] button:** Opens file upload modal → redirects to cession file pipeline.

**Cedant + Contract dropdowns:** Cascade — selecting cedant populates contract dropdown. API: `GET /iris/api/v1/underwriting/population?cedent_id=CED-1042&contract_id=LSC-2024-019`

**Pagination:** Show 50 per page. "14 members" count updates with filter.
