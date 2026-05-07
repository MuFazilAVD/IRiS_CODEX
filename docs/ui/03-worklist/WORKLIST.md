# IRiS — Worklist Page

**Route:** `/worklist`  
**File:** `src/pages/worklist/WorklistPage.tsx`  
**Auth:** All roles (filtered by role)

---

## Layout

```
[Breadcrumb: Operational command center · {Role} view · X of Y tasks]

Worklist                                    [My Tasks] [Team Tasks ●] [All Accessible]
                                                                     [Grid] [List] icons

[Summary Cards Row]

[Search + Filter Bar]
[Quick Filter Pills]

[Task Cards Grid (2-3 columns)]
```

---

## Summary Cards Row (7 cards)
```
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│My Critical │ │  Overdue   │ │  Pending   │ │ Compliance │
│  Tasks     │ │            │ │  Approvals │ │   Holds    │
│    0       │ │     2      │ │     1      │ │     2      │
│ (red left) │ │ (red left) │ │ (blue left)│ │(amber left)│
└────────────┘ └────────────┘ └────────────┘ └────────────┘

┌────────────┐ ┌────────────┐ ┌────────────┐
│AI Exception│ │   Team     │ │ Awaiting   │
│   Queue    │ │  Backlog   │ │ My Review  │
│     1      │ │     3      │ │     1      │
│(teal left) │ │(blue left) │ │(grey left) │
└────────────┘ └────────────┘ └────────────┘
```

Values are role-specific (see mock data). Cards are clickable — click filters the list below.

---

## Search & Filter Bar

```
[🔍 Search task ID, title, cedant, contract, ass...]  [Priority: All ▾] [Status: All ▾] [Category: All ▾] [Source: All ▾]
```

### Quick Filter Pills (below search bar)
```
[⊘ Overdue] [Approval Required] [AI-generated] [Compliance Hold] [High Impact (≥1M)]
Saved views: [Compliance Hot Queue] [Daily Settlement Approvals] [+ Save current]
```

**Priority options:** All | Critical | High | Medium | Low  
**Status options:** All | Open | In Progress | Pending Review | Resolved  
**Category options:** All | Reconciliation Mismatch | OFAC Match | AI Mapping Failure | SFTP Failure | Settlement Approval | Role Assignment | Access Audit | Override Approval  
**Source options:** All | AI Agent | System Rule | Human | SFTP

---

## Task Card Component

```
┌────────────────────────────────────────────────┐
│ [Critical ●] [Hold] [Read-only]        [↗ expand]│
│                                                │
│ OFAC sanctions match — Atlas Corporate Pensions│  ← 15px bold
│ WL-9201 · OFAC Match                          │  ← 12px mono muted
│                                               │
│ [⏱ 8h 47m]                    [AI Agent]     │  ← time + source
│                                               │
│ Compliance Hold · Review Required             │  ← 12px muted breadcrumb
└────────────────────────────────────────────────┘
```

**Priority border colors:**
- Critical: `border-left: 4px solid #E74C3C` (red)
- High: `border-left: 4px solid #E67E22` (orange)
- Medium: `border-left: 4px solid #F39C12` (amber)
- Low: `border-left: 4px solid #3498DB` (blue)

**Time pill:**
- Normal: `background: #F0F2F5 / color: #546E7A`
- Approaching SLA: `background: #FEF5E7 / color: #784212`
- Overdue: `background: #FDEDEC / color: #922B21` + "Overdue" prefix

**Additional badges:**
- `[Hold]`: `background: #EDE7F6 / color: #4A148C / border: 1px solid #CE93D8`
- `[Read-only]`: `background: #F5F5F5 / color: #757575`
- `[AI Agent]`: teal, `background: #E0F7FA / color: #006064`
- `[System Rule]`: grey
- `[Human]`: blue

---

## Expanded Card State (click ↗)
Navigates to a full-page worklist item detail OR expands inline (depends on implementation). Show:
- Full description
- Related contract/cedant links
- Timeline of actions taken
- Resolution buttons: [Take Ownership] [Resolve] [Escalate] [Add Note]

---

## Role-Specific Task Data

### Admin View
- Shows ALL tasks across all roles
- Extra "Assigned To" pill on each card showing which role owns it
- Extra column in list view: "Assigned Role"
- Data: **Mock JSON** from `mock_data/worklist_admin.json`

### Underwriter View
- Tasks: contract amendments, override approvals, OFAC escalations
- Data: **Mock JSON** from `mock_data/worklist_underwriter.json`

### Claims Ops View
- Tasks: settlement variances, SFTP failures, mapping failures, file exceptions
- Data: **LIVE from DB** — `GET /api/v1/claims/worklist`
- Real-time: poll every 30s, show "X tasks updated" banner
- Demo tasks (seeded in DB):
  - WL-9202: Settlement variance breach — Northstar Q1-2026 (Critical, Overdue)
  - WL-9204: AI mapping failure — CES-2026-04-118 (High, 6h 38m)
  - WL-9206: SFTP file ingestion failure — Helvetia Q1 cession (High, Overdue)

### Compliance View
- Tasks: OFAC hits, false positives, override approvals
- Data: **Mock JSON** from `mock_data/worklist_compliance.json`

---

## View Toggle
- **Grid view** (default): 3-column card grid
- **List view**: Compact table rows — WL ID, Title, Priority, Status, Cedant, Due, Assigned

## Empty State
Icon + "No tasks match your filters" + [Clear filters] button

## Loading State
3 skeleton cards in grey with shimmer animation
