# IRiS — Build Plan Additions
## APPENDS TO: build-plan/BUILD_PLAN.md

The original BUILD_PLAN.md covers Phases 0–12. Add the following phases.

---

## PHASE 8 (REVISED): Cession File Processing — V2 Pipeline

**Replaces:** Original Phase 8 (10-step modal pipeline)

The screenshots show a **full-page pipeline** with left-nav steps, not a 10-step modal.

### Updated Architecture
- Route: `/operations/:process_id` (full page, not modal)
- Left nav: 6 steps (Normalization, Calculations, Variance Analysis, Screening, AI Decision, Outcome)
- Each step renders its own content area with inner tabs where applicable
- `[Next Phase →]` button in top right advances to next step
- `[Back to Queue]` link in left panel
- `[Abort Process]` button top right

### Backend
1. `GET /api/v1/operations/pipelines` — active pipelines list
2. `GET /api/v1/operations/pipelines/{process_id}` — full pipeline state
3. `GET /api/v1/operations/pipelines/{process_id}/normalization` — normalization tabs data
4. `GET /api/v1/operations/pipelines/{process_id}/calculations`
5. `GET /api/v1/operations/pipelines/{process_id}/variance`
6. `GET /api/v1/operations/pipelines/{process_id}/screening`
7. `GET /api/v1/operations/pipelines/{process_id}/ai-decision`
8. `GET /api/v1/operations/pipelines/{process_id}/outcome`
9. `POST /api/v1/operations/pipelines/{process_id}/advance`
10. `POST /api/v1/operations/pipelines/{process_id}/abort`

### Frontend Components
1. `CessionFilesPage.tsx` — file queue + metrics (same as before)
2. `PipelinePage.tsx` — full-page pipeline with left nav
3. `PipelineLeftNav.tsx` — 6 steps with status indicators (pending/in_progress/complete)
4. `NormalizationStep.tsx` — with 5 inner tabs
5. `CalculationsStep.tsx`
6. `VarianceAnalysisStep.tsx`
7. `ScreeningStep.tsx` — calls `/api/v1/compliance/sanctions/screen` per entity
8. `AIDecisionStep.tsx`
9. `OutcomeStep.tsx`
10. `WorklistDetailPage.tsx` — full-page worklist item detail (from IMG_1985)

### Codex Prompt for Phase 8
```
Build Phase 8 (REVISED): Operations Pipeline (V2 full-page format).
Reference:
  - iris-docs/ui/05-claims/settlements/SETTLEMENTS_AND_CALC_ENGINE.md
  - iris-docs/ui/CORRECTIONS_FROM_SCREENSHOTS.md
  - iris-docs/api/API_ADDITIONS.md → "Pipeline API" section
  - iris-docs/mock-data/MOCK_DATA_ADDITIONS.md → pipeline seeds
  - ui-screens: IMG_1988.jpeg, IMG_1993.jpeg through IMG_2002.jpeg
Phases complete: 0-7
Build: PipelinePage, all 6 step components, WorklistDetailPage
The screening step must call the sanctions screen API which uses the 
2-step keyword → LLM flow.
```

---

## PHASE 9 (REVISED): Settlements + Calculation Engine

### Updated Settlements (from IMG_1986 / IMG_1987 / IMG_2002)
- Route stays `/claims/settlements`
- Metrics row: Pending Approval | Pending Amount | Paid YTD | Disputes
- Table shows settlement records with net amount + direction coloring
- Settlement detail: slide-in panel with Approve/Hold/Dispute buttons
- Settlement can also be approved directly from the Pipeline Outcome step

### Contract Detail — Performance Tab Update (from IMG_1987)
The contract CON-2024-001 detail page (Overview tab) shows:
- Header: contract ID + status badge + version + [Settle Period] [Amend Protocol] buttons
- 4 KPI chips: Aggregate Exposure $45M +2.1% | Latest Net Payout +$4.2M | A/E Variance L30D +2.1% | Next Settlement 2026-06-30
- Tabs: Overview | Rules & Configuration | Member Population | Financials | Amendments | Audit Log | Risk & Insights
- Overview tab: Recent Operational Trace (timeline of recent events) + Vitality Indices (Trend Stability, Ingestion Integrity, SLA Performance)
- Right panel: Decision Intelligence (IRiS AI insight text) + Technical Vault (Source Registry Logs, Master Treaty PDF, Counterparty Node links)

### Codex Prompt for Phase 9
```
Build Phase 9: Settlements + Contract Detail V2.
Reference:
  - iris-docs/ui/05-claims/settlements/SETTLEMENTS_AND_CALC_ENGINE.md
  - iris-docs/api/API_ADDITIONS.md → Settlements section
  - iris-docs/mock-data/MOCK_DATA_ADDITIONS.md → settlements_seed.json
  - ui-screens: IMG_1986.jpeg, IMG_1987.jpeg, IMG_2002.jpeg
Phases complete: 0-8
```

---

## PHASE 13 (NEW): Compliance Module

### 13a: Sanctions Screening Page
Build the compliance/sanctions page with screening flow integration.

### 13b: Audit & Traceability Page
Build the full Audit & Traceability module with left nav and all sections.

### Backend
All APIs from `api/API_ADDITIONS.md` → Compliance API + Audit API sections.

### Key AI Integration
The Screening step calls Claude API for LLM verification when keyword match found.
System prompt:
```
You are a sanctions compliance verification agent for IRiS, a reinsurance platform.
You have been called because a keyword/fuzzy match was found in a watchlist.
Determine if the match is genuine or a false positive.
Be conservative — when in doubt, flag for human review.
Return ONLY valid JSON: {"is_genuine_match": bool, "confidence": float, "reasoning": str}
```

### Codex Prompt for Phase 13
```
Build Phase 13: Compliance Module (Sanctions + Audit & Traceability).
Reference:
  - iris-docs/ui/06-compliance/COMPLIANCE_UI.md
  - iris-docs/api/API_ADDITIONS.md → Compliance API + Audit API sections
  - iris-docs/db/SCHEMA_ADDITIONS.md → tables 32-39
  - iris-docs/mock-data/MOCK_DATA_ADDITIONS.md → screening + audit seeds
  - ui-screens: IMG_1999.jpeg (screening), all Audit* and ManualOverrides project screenshots
Phases complete: 0-12
Build: SanctionsPage, AuditPage with full left nav (9 sub-sections)
The screening flow: keyword match → LLM verification → result
The audit trail reads from audit_events table (seeded)
```

---

## PHASE 14 (NEW): Reports Module

**POC:** Fully mock. Table of reports from `reports` DB table. Clicking Open → shows static mock data.

### Backend
- `GET /api/v1/reports` → query reports table, filter by role
- `GET /api/v1/reports/{report_id}` → return hardcoded mock report data
- `POST /api/v1/reports/export` → return static mock file

### Frontend
- `ReportsPage.tsx` — category sidebar + global filters + report table
- `ReportDetailPage.tsx` — static mock table data per report ID

### Codex Prompt for Phase 14
```
Build Phase 14: Reports Module.
Reference:
  - iris-docs/ui/08-reports/REPORTS.md
  - iris-docs/api/API_ADDITIONS.md → Reports API
  - iris-docs/db/SCHEMA_ADDITIONS.md → reports table + seed
  - ui-screens: Reports1.png, Reports2.png (project folder)
Phases complete: 0-13
All data is mock — load from reports DB table and return hardcoded preview data.
```

---

## PHASE 15 (NEW): Administration Module

### 15a: Users & Roles
**Working** — reads/writes `users` table.
- Users list tab
- Permissions tab (static)
- Approval Matrix tab (static)
- Access Logs tab (from audit_events filtered by module='access')
- + New User flow with auto-generated temp password
- Edit/Revoke user

**Codex creates these 6 seed users on first run** (password: `demo1234`):
| Email | Role |
|-------|------|
| admin@metlife-re.demo | super_admin |
| m.patel@reinsure.io | underwriter |
| a.chen@reinsure.io | claims_ops |
| j.morales@reinsure.io | compliance |
| d.rhodes@reinsure.io | admin |
| h.suzuki@reinsure.io | underwriter |

### 15b: Reference Data Library
**Mock** — reads from `reference_data_versions` table (seeded).
- 6 tabs: Currencies & FX | Mortality Tables | Yield Curves | Assumption Sets | File Templates | Screening Cache
- [+ New Version] button opens upload modal (mock in POC)
- [Force Sync] on screening cache lists (mock toast only)

### Codex Prompt for Phase 15
```
Build Phase 15: Administration Module.
Reference:
  - iris-docs/ui/09-admin/ADMIN_UI.md
  - iris-docs/api/API_ADDITIONS.md → Admin API section
  - iris-docs/db/SCHEMA_ADDITIONS.md → reference_data_versions, screening_cache_lists tables
  - iris-docs/mock-data/MOCK_DATA_ADDITIONS.md → reference data seed rows
  - ui-screens: UsersRoles.png, UserRole_Permissions.png, UserRole_ApprovalMatrix.png,
               UserRole_AccessLogs.png, ReferenceLibrary.png + all ReferenceLibrary_*.png
Phases complete: 0-14
Users & Roles reads/writes DB. Reference Library reads from seeded DB tables.
Create the 6 seed users with password demo1234 in the DB migration.
```

---

## PHASE 16 (NEW): Navigation + Sidebar Updates

Update navigation to reflect full sidebar structure visible in screenshots:

```
Operations
  Dashboard
  Worklist

Contract Management         ← new top-level item (underwriter view)
  [same as Contracts page]

Operations                  ← sidebar item (claims_ops)
  [links to pipeline page]

Compliance
  [existing]

Reports                     ← NEW nav item (all roles, filtered)

Administration              ← NEW section
  Users & Roles
  Reference Library
```

Also update the IRiS Chatbot (from Chatbot.png):
- Header: "IRiS Assist" (not "IRiS Assistant")
- Role chip under title: "Compliance · /"
- Opening message: "Hi, I'm IRiS Assist. I can answer questions about what's on screen, navigate you to any module you're permitted to access, and pull up specific contracts, settlements, files or screening hits. Try 'show me contract LSC-2024-019' or 'what's the Q1 settlement variance?'"
- **Quick actions row** (role-specific chips, 3–4 max):
  - Compliance: "Show me the latest screening hits" | "Open the compliance dashboard" | "Any FYA items on my worklist?" | "Show recent audit trail entries"
- Input placeholder: "Ask about anything on screen..."

---

## PHASE 17 (NEW): Polish Pass

- Dashboard graphs: add Population Movement area chart + Renewal Pipeline grouped bar for UW dashboard
- Dashboard: add High-Risk Cedants panel + High-Impact Exceptions panel
- Worklist: update compliance worklist mock data with WL-9208
- Worklist: update admin worklist mock data with WL-9211, WL-9213
- All audit trail sections: wire to `audit_events` table reads
- Chatbot: update with role-specific quick action chips
- IRiS Insight banner: wire to `intelligence_feeds_complete.json`
