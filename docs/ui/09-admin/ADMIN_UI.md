# IRiS — Administration Module

## Routes
- `/admin/users` → Users & Roles
- `/admin/library` → Reference Data Library
- `/admin/workflow-agents` → Workflow Agents

**Auth:** `admin`, `super_admin`

---

# USERS & ROLES PAGE

**Route:** `/admin/users`

## Layout

```
Home › Administration › Users & Roles

User & Role Management                             [+ New User]
Identity, RBAC, data entitlements, approval matrices, access logs

[Users] [Permissions] [Approval Matrix] [Access Logs]   ← horizontal tabs

[Active tab content]
```

---

## TAB 1: Users

### Table Header: "5 users"

Columns: Name | Email | Role | Status | Last Login | Actions

```
Mia Patel      m.patel@reinsure.io    [Underwriting]  [Active]   2025-04-29 08:42  Edit  Revoke
Aaron Chen     a.chen@reinsure.io     [Claims Ops]    [Active]   2025-04-29 09:01  Edit  Revoke
Julia Morales  j.morales@reinsure.io  [Compliance]    [Active]   2025-04-29 09:14  Edit  Revoke
Devon Rhodes   d.rhodes@reinsure.io   [Admin]         [Active]   2025-04-28 17:55  Edit  Revoke
Hana Suzuki    h.suzuki@reinsure.io   [Underwriting]  [Invited]  —                 Edit  Revoke
```

**Role badge colors:**
- Underwriting → blue
- Claims Ops → teal
- Compliance → amber
- Admin → grey
- super_admin → dark navy

**Status badge:**
- Active → green
- Invited → grey/outlined
- Suspended → red
- Inactive → grey

**[Edit] button:** Opens inline or slide-in form with: Name, Email, Role (select), Status.  
**[Revoke] button:** Confirms revocation → sets status=Suspended → creates audit log.

### [+ New User] button
Opens a modal:
```
New User
────────────────────────────────
Full Name:  [______________]
Email:      [______________]
Role:       [Select role ▾]
            - super_admin
            - admin
            - underwriter
            - claims_ops
            - compliance
────────────────────────────────
[Cancel]  [Create & Send Invite]
```

On create:
- Inserts row into `users` table
- Sets status = 'invited'
- Password = auto-generated `iris_` + 8 random chars (shown once in success toast)
- Creates audit log entry

### Seed Users (POC — Codex should create these on first run)

| Full Name | Email | Role | Password |
|-----------|-------|------|----------|
| Admin User | admin@metlife-re.demo | super_admin | admin@2026 |
| Mia Patel | m.patel@reinsure.io | underwriter | admin@2026 |
| Aaron Chen | a.chen@reinsure.io | claims_ops | admin@2026 |
| Julia Morales | j.morales@reinsure.io | compliance | admin@2026 |
| Devon Rhodes | d.rhodes@reinsure.io | admin | admin@2026 |
| Hana Suzuki | h.suzuki@reinsure.io | underwriter | admin@2026 |

---

## TAB 2: Permissions

### Module Permissions Matrix

Columns: Module | View | Edit | Approve | Override

```
Underwriting      | Underwriting · Admin           | Underwriting    | Underwriting | Admin
Cession Management| Claims Ops · Admin             | Claims Ops      | Claims Ops   | Admin
Compliance        | Compliance · Admin             | Compliance      | Compliance   | Admin
Library           | Admin · Underwriting · Compliance| Admin          | Admin        | Admin
Settlements       | Claims Ops · Underwriting · Admin| Claims Ops     | Underwriting | Admin
```

Each cell shows role tags (colored pills). Read-only in POC — no inline editing.

---

## TAB 3: Approval Matrix

### Approval Thresholds

Columns: Action | Threshold | Required Approvers

```
Settlement payout     | < $10M          | 1 × Claims Ops Lead
Settlement payout     | $10M – $50M     | 1 × Claims Ops Lead + 1 × Underwriting
Settlement payout     | > $50M          | 1 × Underwriting + 1 × CFO
Contract amendment    | Any             | 2 × Underwriting (4-eyes)
Reference data change | Any locked dataset | 1 × Admin + 1 × Compliance
```

Read-only in POC. Edit functionality flagged for Phase 2.

---

## TAB 4: Access Logs

### Access Events (last 24h)

Columns: Timestamp | User | Resource | Action | IP

```
2025-04-29 09:14:22 | j.morales | /compliance/screening/SHM-887        | VIEW     | 10.42.1.18
2025-04-29 09:01:54 | a.chen    | /cession/CES-2025-09-018             | DOWNLOAD | 10.42.2.04
2025-04-29 08:42:12 | m.patel   | /contracts/LSC-2024-019              | EDIT     | 10.42.1.51
2025-04-29 07:55:40 | system    | /library/mortality/CMI-2024-M        | VIEW     | internal
2025-04-28 17:55:01 | d.rhodes  | /admin/users                         | CREATE   | 10.42.0.91
```

**Action badge colors:** VIEW=grey, EDIT=blue, DOWNLOAD=amber, CREATE=green, DELETE=red

---

# REFERENCE DATA LIBRARY PAGE

**Route:** `/admin/library`

## Layout

```
Home › Administration › Reference Library

Reference Data Library                             [+ New Version]
Core system dependency · version-controlled · lockable at contract level

[Currencies & FX] [Mortality Tables] [Yield Curves] [Assumption Sets] [File Templates] [Screening Cache]
```

---

## TAB 1: Currencies & FX

**Section header:** "Currencies & FX Rates"  
**Subtitle:** "As of 2025-04-29 · Bloomberg"

Columns: Code | Name | FX → USD | As Of | Source | Version | Actions

```
USD | US Dollar      | 1.0000 | 2025-04-29 | Bloomberg | v2025.04.29 | History
GBP | British Pound  | 1.2520 | 2025-04-29 | Bloomberg | v2025.04.29 | History
EUR | Euro           | 1.0710 | 2025-04-29 | Bloomberg | v2025.04.29 | History
CHF | Swiss Franc    | 1.1080 | 2025-04-29 | Bloomberg | v2025.04.29 | History
CAD | Canadian Dollar| 0.7320 | 2025-04-29 | Bloomberg | v2025.04.29 | History
```

[History] → slide-in with version history of that currency rate.

---

## TAB 2: Mortality Tables

**Section header:** "Mortality Tables"

Columns: ID | Name | Source | Version | Effective | Status | Contracts Using | Actions

```
CMI-2024-M  | CMI Self-Administered Pension Schemes 2024 — Male   | CMI     | 2024  | 2025-01-01 | [Active]  | 12 |
CMI-2024-F  | CMI Self-Administered Pension Schemes 2024 — Female | CMI     | 2024  | 2025-01-01 | [Active]  | 12 |
SOA-2024-G2 | SOA Pri-2012 with MP-2021 — Generational            | SOA     | 2024.1| 2024-04-01 | [Active]  |  8 |
BVS-DE-2018G| Heubeck Richttafeln 2018 G                          | Heubeck | 2018G | 2019-01-01 | [🔒 Locked]|  4 |
```

**ID shown in monospace `code` style.**  
**[Locked] badge:** amber with lock icon. Cannot be edited. Contracts referencing it are locked to this version.

---

## TAB 3: Yield Curves

**Section header:** "Yield Curves & Discount Rates"

Columns: ID | Currency | Source | As Of | Tenors | Status | Version | Actions

```
YC-GBP-GILT  | GBP | Bank of England  | 2025-04-29 | 30 | [Active] | v2025.04.29 |
YC-USD-UST   | USD | US Treasury H.15 | 2025-04-29 | 30 | [Active] | v2025.04.29 |
YC-EUR-EIOPA | EUR | EIOPA RFR        | 2025-03-31 | 30 | [Active] | v2025.03.31 |
YC-CHF-SARON | CHF | SIX SARON Curve  | 2025-04-29 | 30 | [Active] | v2025.04.29 |
```

---

## TAB 4: Assumption Sets

**Section header:** "Assumption Sets · Mortality + Discounting + Inflation"

Columns: ID | Name | Mortality | Curve | Inflation | Used By | Lock | Actions

```
AS-2025-NS-019 | Northstar 2025 Base  | CMI-2024-M/F | YC-GBP-GILT  | RPI 3.1% | LSC-2024-019 | 🔒 Locked  |
AS-2025-HV-031 | Helvetia 2025 Base   | BVS-CH-2020  | YC-CHF-SARON | CPI 1.4% | LSC-2024-031 | 🔒 Locked  |
AS-2025-ML-044 | Maple Leaf 2025 Base | SOA-2024-G2  | YC-CAD-GoC   | CPI 2.2% | LSC-2024-044 | 🔒 Locked  |
AS-2025-AT-007 | Atlas 2025 Draft     | SOA-2024-G2  | YC-USD-UST   | CPI 2.4% | LSC-2025-007 | Editable   |
```

**Locked rows** → amber lock icon, no edit button.  
**Editable rows** → [Edit] [Lock] buttons.

---

## TAB 5: File Templates

**Section header:** "File Ingestion Templates"

Columns: Template | Cedant | Fields | Format | Version | Actions

```
TPL-NS-CES-v3 | Northstar Pension Trust  | 84 | CSV | v3.2 | [View] [Download]
TPL-HV-CES-v2 | Helvetia Retirement Fund | 76 | CSV | v2.1 | [View] [Download]
TPL-ML-CES-v1 | Maple Leaf Pension Plan  | 71 | XML | v1.4 | [View] [Download]
TPL-BV-CES-v2 | Bavarian Industrial Fund | 88 | CSV | v2.0 | [View] [Download]
```

[View] → opens template schema detail (field names, types, validation rules)  
[Download] → download the template file

---

## TAB 6: Screening Cache

**Section header:** "Screening List Cache"

Columns: List | Provider | Records | Last Sync | Status | Actions

```
OFAC SDN         | US Treasury     | 12,847    | 2025-04-29 04:00 | [Active] | [Force Sync]
FinCEN 314(a)    | FinCEN          |  4,122    | 2025-04-29 04:05 | [Active] | [Force Sync]
EU Consolidated  | European Council|  8,490    | 2025-04-29 04:10 | [Active] | [Force Sync]
FIS Adverse Media| FIS             | 2,140,882 | 2025-04-29 03:30 | [Active] | [Force Sync]
```

**[Force Sync] button:** Mock — shows "Sync initiated" toast. No real API call in POC.

> **Note:** These are the screening lists used in the Compliance & AML step of the pipeline and the Sanctions Screening page. The screening happens against these cached lists first (keyword match), then LLM verification if a match is found.

---

## [+ New Version] button

Opens a modal for uploading a new version of any reference data item:
```
Upload New Reference Data Version
────────────────────────────────
Data Type:   [Select ▾]   (Mortality Table / Yield Curve / FX Rate / etc.)
Source:      [______________]
Effective:   [date picker]
File:        [Choose file]
Notes:       [______________]
────────────────────────────────
[Cancel]  [Upload & Validate]
```

On upload: validates format, creates new versioned record. Existing locked contracts are NOT affected. New/editable contracts can be updated to reference the new version.

---

# WORKFLOW AGENTS PAGE

**Route:** `/admin/workflow-agents`

## Layout

```
Home › Administration › Workflow Agents

Workflow Agents                                         [Refresh]
Configure agent enablement, confidence thresholds, HITL behavior, escalation, retries, and fallbacks for the cession workflow.

[Agent cards in a 2-column grid]
```

Each agent card shows:
- step label and agent name
- enabled checkbox
- confidence threshold
- `Always stop for HITL` switch
- HITL behavior
- retry limit
- fallback mode
- escalation rule
- save action

### HITL Override Switch

The `Always stop for HITL` control is a dedicated on/off switch with a raised skeuomorphic treatment.

- `Off` → agent pauses only when confidence falls below threshold or the workflow logic explicitly requires human review
- `On` → agent pauses for HITL on every run, irrespective of the configured threshold

The existing `HITL Behavior` dropdown still controls the pause type (`Pause for approval` vs `Pause for correction`) when the workflow stops.
