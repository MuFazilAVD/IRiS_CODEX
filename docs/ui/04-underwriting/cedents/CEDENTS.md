# IRiS — Cedants Pages

---

# CEDANTS LIST PAGE

**Route:** `/underwriting/cedants`  
**File:** `src/pages/underwriting/cedents/CedantsPage.tsx`  
**Auth:** `underwriter`, `super_admin`

## Layout

```
Home › Underwriting › Cedants

Cedants                                              [+ New Cedant]
Counterparties ceding longevity risk to the platform

[🔍 Search by ID, name, country...]   [All ▾]            6 of 6

Cedants Register
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ID        │ Name                      │ Country │ AUM    │ Contracts│Screening│Status     │Onboarded  │Action        │
├───────────┼───────────────────────────┼─────────┼────────┼──────────┼─────────┼───────────┼───────────┼──────────────┤
│ CED-0991  │ Sterling Heritage Pensions│ UK      │ $1.2B  │ 0        │ Cleared │ Inactive  │ 2018-09-01│ Reactivate → │
│ CED-1042  │ Northstar Pension Trust   │ UK      │ $12.4B │ 4        │ Cleared │ Active    │ 2021-03-14│ View/Edit →  │
│ CED-1087  │ Helvetia Retirement Fund  │ CH      │ $8.7B  │ 3        │ Cleared │ Active    │ 2022-07-02│ View/Edit →  │
│ CED-1133  │ Atlas Corporate Pensions  │ US      │ $5.3B  │ 1        │ Pending │ Onboarding│ 2025-01-19│ View/Edit →  │
│ CED-1156  │ Maple Leaf Pension Plan   │ CA      │ $3.9B  │ 2        │ Cleared │ Active    │ 2023-11-08│ View/Edit →  │
│ CED-1201  │ Bavarian Industrial Fund  │ DE      │ $6.1B  │ 2        │ Review  │ Active    │ 2024-04-22│ View/Edit →  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Table column details:**
- **ID**: `12px mono / color: #1A6B9A` (link color, clickable)
- **Name**: `13px / bold / color: #1A6B9A` (link, navigate to detail)
- **Country**: flag emoji + ISO code
- **AUM**: right-aligned, `13px`
- **Contracts**: number (0 = grey, >0 = normal)
- **Screening**: `<StatusBadge>` — cleared/pending/review/failed
- **Status**: `<StatusBadge>` — active/inactive/onboarding/suspended
- **Onboarded**: date string `YYYY-MM-DD`
- **Action**: "View / Edit →" link or "Reactivate →" for inactive

**Filter dropdown options:** All | Active | Inactive | Onboarding

**Row click:** Navigate to `/underwriting/cedants/{cedent_id}`

**+ New Cedant button:** Opens `<NewCedantWizard />` modal

---

# NEW CEDANT WIZARD

**Trigger:** "+ New Cedant" button  
**File:** `src/pages/underwriting/cedents/NewCedantWizard.tsx`  
**Type:** Modal overlay (full-screen with scroll)

## Modal Header
```
New Cedant Onboarding            [×]
CED-1202 · Step {n} of 13
```

## Left Navigation (13 steps)
```
► AI Document Intake          ← step 0 (active dot = filled teal)
1  Legal Entity
2  Pension Scheme
3  Key Contacts
4  Financial & Treasury
5  Contract Readiness
6  Population & Exposure
7  Compliance & KYC
8  Regulatory & Docs
9  Operational Connectivity
10 Actuarial Preferences
11 Access & Beneficiary Rules
12 Sanction Screening
13 Audit & Approval
```
Active step: teal filled circle + bold text  
Completed: teal outline circle + normal text  
Incomplete: grey circle + muted text

## Footer
```
[Save as Draft]                     [← Back]  [Continue to Forms → / Next →]
```

---

## Step 0: AI Document Intake

```
AI Document Intake

┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                    [📄 upload icon]                          │
│                                                               │
│              Upload an onboarding pack                       │
│    Drop in a counterparty profile, scheme summary,           │
│    ISDA, KYC pack, or trustee report. Our AI agent           │
│    will pre-fill cedant fields with verbatim citations        │
│    and confidence scores.                                     │
│                                                               │
│        [Choose file]    [Try sample document]                │
│                                                               │
│  Supported: TXT, MD, CSV, JSON. PDFs and DOCX accepted       │
│  but processed as raw text.                                  │
└───────────────────────────────────────────────────────────────┘
```

**After upload:** Shows loading spinner "IRiS is extracting fields..."  
Then shows: "✓ 14 fields pre-filled across 3 sections. 2 low-confidence fields flagged."  
Each extracted field in subsequent steps shows: value + `[confidence %]` chip + citation tooltip  
Low-confidence: amber border + warning icon

**API call:** `POST /api/v1/underwriting/cedents/ai-extract`

---

## Step 1: Legal Entity

Form with 3-column grid layout. Fields:
```
Row 1: [Cedant ID (auto)] [Legal Entity Name *] [Trading Name]
Row 2: [Registered Company Number] [Tax Identification Number] [LEI (20-char ISO 17442)]
Row 3: [Entity Type (select)] [Jurisdiction of Incorporation] [Country of Registration]
Row 4: [Date of Incorporation] [Regulatory Status (select)] [Ownership Structure]
Row 5: [Parent Company] [Group Structure (textarea, full width)]
```

Entity Type options: Pension Trust | Life Insurer | Corporate | Government | Other  
Regulatory Status options: Regulated | Unregulated | Exempt

---

## Step 2: Pension Scheme
```
Row 1: [Scheme Name] [Scheme Type (select)] [Scheme Registration Number]
Row 2: [Trustee Name] [Trustee Type] [Administrator]
Row 3: [Total Members] [Active Members] [Deferred Members] [Pensioner Members]
Row 4: [Total Assets Amount] [Total Assets Currency] [Total Liabilities Amount]
Row 5: [Funding Level %] [Valuation Date] [Actuarial Firm] [Investment Consultant]
```

---

## Step 3: Key Contacts
Add multiple contacts. Each contact card:
```
[Contact Name] [Role/Title] [Department]
[Email] [Phone] [Is Primary? checkbox]
[Contact Type: trustee/legal/operational/actuary/compliance]
```
[+ Add Another Contact] button at bottom

---

## Step 4: Financial & Treasury
```
[Bank Name] [Account Number] [Sort Code]
[IBAN] [SWIFT/BIC] [Account Currency]
[Payment Method] [Settlement Instructions (textarea)]
```

---

## Step 5: Contract Readiness
Checklist with date fields:
```
☐ ISDA Agreement Signed    [Date]
☐ CSA (Credit Support Annex) Signed    [Date]
☐ NDA Signed    [Date]
☐ KYC Complete
☐ AML Review Complete
☐ Data Sharing Agreement Signed
☐ File Format Agreed
☐ SFTP Configured & Tested
[Notes textarea]
```

---

## Step 6: Population & Exposure
```
[Total Lives] [Average Age] [% Male] [% Female]
[Total Annuity PA Amount] [Currency] [Avg Annuity per Life]
[Geographic Spread (textarea)] [Age Distribution (textarea)]
[Mortality Table Used (select)]
```

---

## Step 7: Compliance & KYC
```
[KYC Status (select)] [KYC Completed Date] [KYC Provider]
[AML Status (select)] [PEP Check Done ☐] [Beneficial Owner Verified ☐]
[High Risk Jurisdiction ☐] [Risk Rating (select: low/medium/high)]
[Review Frequency] [Next Review Date]
[Notes textarea]
```

---

## Step 8: Regulatory & Docs
File upload table. Add rows:
```
[Doc Type] [Doc Name] [Doc Date] [Expiry Date] [Regulator] [Upload file]
[+ Add Document]
```

---

## Step 9: Operational Connectivity
```
[SFTP Host] [SFTP Port: 22] [SFTP Username]
[SFTP Key Fingerprint] [SFTP Status (select)]
[File Format (CSV/XLSX/XML)] [File Encoding]
[Submission Frequency (Monthly/Quarterly)]
[Notification Email]
[Test Connection] button → shows ✓ Connected / ✗ Failed
```

---

## Step 10: Actuarial Preferences
```
[Mortality Table (select: CMI S3 / SOA 2014 / DAV 2008T / Custom)]
[Improvement Scale (select: CMI 2022 / MP-2021 / Custom)]
[Base Year] [Long Term Rate %] [Initial Rate %] [Convergence Period (years)]
[Age Rating Adjustment] [Loading Factor] [Discount Rate] [Discount Basis]
[Valuation Method] [Experience Study Frequency]
[Notes textarea]
```

---

## Step 11: Access & Beneficiary Rules
Add multiple rules:
```
[Rule Type (spousal/dependant/contingent)] [% of Benefit] [Conditions textarea]
[Rule Description textarea]
[+ Add Rule]
```

---

## Step 12: Sanction Screening
```
Trigger Initial Screening

[Run OFAC Scan]    [Run FinCEN Scan]    [Run All Sources]

Status will appear below after running...
[loading → result cards per source]
```

If match found: show alert + "Review required" note  
Cleared: green ✓ + reference ID

---

## Step 13: Audit & Approval
```
Summary of all completed sections (read-only)
Green ✓ or amber ⚠ per section

Certification:
"I confirm the information above is accurate and complete."
[☐ I acknowledge this cedant onboarding for approval]

[Submit for Approval]
```

On submit: Creates worklist item for approval, redirects to cedants list.

---

# CEDANT DETAIL PAGE

**Route:** `/underwriting/cedants/{cedent_id}`  
**File:** `src/pages/underwriting/cedents/CedantDetailPage.tsx`

## Header
```
← Back to Cedants

Northstar Pension Trust                    [Active] [Screening: Cleared]  [⚠ Deactivate]  [✏ View/Edit]
CED-1042 · UK · 4 contract(s) · AUM $12.40B
```

## Layout
Uses `<SectionPanel>` with left nav + right content.

### Left Nav Sections
```
Master Data
  01 Legal Entity         ← default active
  02 Pension Scheme
  03 Key Contacts
  04 Financial & Treasury
  05 Contract Readiness
  06 Population & Exposure
  07 Compliance & KYC
  08 Regulatory & Docs
  09 Operational Connectivity
  10 Actuarial Preferences
  11 Access & Beneficiary Rules
  12 Sanction Screening
  13 Audit & Approval

Linked Data
  A  Mapped Contracts
  B  Calculations
```

### Section 01: Legal Entity
Read-only `<FieldGrid cols={3}>` displaying all legal entity fields.  
[Edit] button top-right → inline edit mode → [Save] [Cancel]

### Section 07: Compliance & KYC
KYC status + AML fields + risk rating. Similar field grid.

### Section 12: Sanction Screening
**Sanction Screening History** header with 4 KPI chips:
```
[Total Scans: 18] [Open Hits/Reviews: 3] [Sources Monitored: 2] [Next Periodic Due: 2025-09-15]
```

**Source Status cards (2 columns):**
```
┌─────────────────────────┐  ┌─────────────────────────┐
│ OFAC              Cleared│  │ FinCEN            Cleared│
│ Last scan: 2025-03-15   │  │ Last scan: 2025-03-15   │
│ Reference: REF-50000    │  │ Reference: REF-50001    │
│ Matches: 0              │  │ Matches: 0              │
│ [Trigger OFAC Scan]     │  │ [Trigger FinCEN Scan]   │
└─────────────────────────┘  └─────────────────────────┘
[Run Adhoc Screening — All Sources]
```

**Screening History table:**
Filter: [ALL] [OFAC] [FinCEN]  
Columns: Date | Source | Result | Reference ID | Matches | Action

### Section A: Mapped Contracts
Table of all contracts linked to this cedant.  
Columns: Contract ID | Name | Notional | Status | Inception | Lives | Action

### Linked Section B: Calculations
Aggregation calculator (same as contract calculations tab).

### Inactive Cedant Detail (`status: inactive`)
Shows all info as read-only. Header has `[Inactive]` badge.  
Action button changes to `[Reactivate →]`.  
Reactivate requires compliance sign-off — creates worklist item.
