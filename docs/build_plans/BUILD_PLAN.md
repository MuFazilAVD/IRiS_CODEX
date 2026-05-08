# IRiS — Codex Build Plan

Step-by-step build order. Each phase is independently completable.  
Each phase assumes all previous phases are working.

---

## PHASE 0: Project Scaffold
**Goal:** Running frontend + backend with "hello world"

### Steps
1. Create monorepo: `iris/frontend` (Vite + React + TS + Tailwind) + `iris/backend` (FastAPI)
2. Install frontend deps: `react-router-dom@6`, `@tanstack/react-query`, `zustand`, `axios`, `recharts`, `lucide-react`
3. Install backend deps: `fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `psycopg2-binary`, `pydantic`, `python-jose`, `passlib`, `anthropic`
4. Configure Tailwind with iris color palette (see `DESIGN.md`)
5. Set up `.env` for both: DB URL, Anthropic key, JWT secret
6. Run Alembic migration with all tables from `SCHEMA.md`
7. Seed DB with `mock-data/MOCK_DATA.md` seed files
8. Verify: `GET /` returns `{"status": "ok", "version": "1.0.0"}`

---

## PHASE 1: Auth
**Goal:** Login → JWT → Role → Redirect to Dashboard

### Backend
1. `POST /iris/api/v1/auth/login` — validate email/password, return JWT with role claim
2. `POST /iris/api/v1/auth/sso` — return super_admin JWT (no body needed)
3. `GET /iris/api/v1/auth/me` — decode JWT, return user object
4. JWT middleware on all other routes

### Frontend
1. `LoginPage.tsx` — exact layout per `LOGIN.md`
   - Dark bg with ring pattern CSS
   - MetLife logo + IRiS branding
   - Email/password fields (pre-filled for POC)
   - "Sign in to IRiS" button → POST /auth/login
   - "Continue with Enterprise SSO" → POST /auth/sso
   - Error state: red inline message
2. `authStore.ts` (Zustand) — `{ user, token, setUser, setToken, logout, isAuthenticated }`
3. `ProtectedRoute.tsx` — redirect to /login if not authenticated
4. `RoleGate.tsx` — render children only if role matches

**Test:** Login as each role → correct role stored → redirect to /dashboard

---

## PHASE 2: App Shell + Navigation
**Goal:** Sidebar, topbar, routing skeleton

### Frontend
1. `AppShell.tsx` — sidebar + topbar + main content area
2. `Sidebar.tsx`:
   - IRiS logo + MetLife branding
   - Role-aware navigation items (see LAYOUT.md)
   - Active state detection via `useLocation()`
   - Collapse toggle (icon-only mode)
   - Version string at bottom
3. `Topbar.tsx`:
   - Environment pill (hardcoded)
   - Role dropdown (super_admin only) — on change, update `authStore.activeRole`
   - User avatar dropdown (logout)
4. Set up all routes in `App.tsx`:
   ```
   /login           → LoginPage (public)
   /dashboard       → DashboardPage (protected)
   /worklist        → WorklistPage (protected)
   /underwriting/cedants          → CedantsPage (underwriter|super_admin)
   /underwriting/cedants/:id      → CedantDetailPage
   /underwriting/contracts        → ContractsPage
   /underwriting/contracts/:id    → ContractDetailPage
   /underwriting/population       → PopulationPage
   /claims/cession-files          → CessionFilesPage (claims_ops|super_admin)
   /claims/settlements            → SettlementsPage
   /claims/calculation-engine     → CalcEnginePage
   /compliance/sanctions          → SanctionsPage (compliance|super_admin)
   ```
5. Each route page: just a placeholder `<div>Page name</div>` for now

**Test:** Sidebar shows correct items per role. Role dropdown switches view for super_admin.

---

## PHASE 3: Dashboard
**Goal:** All 4 role dashboards working with KPI cards + graphs

### Backend
1. `GET /iris/api/v1/dashboard/kpis` — read from `dashboard_kpis.json`, filter by role
2. `GET /iris/api/v1/dashboard/intelligence` — read from `intelligence_feeds.json`
3. `GET /iris/api/v1/dashboard/graphs` — read from `graph_data.json`
4. `GET /iris/api/v1/dashboard/recent-activities` — read from `recent_activities.json`

### Frontend
1. `DashboardPage.tsx` — role-conditional rendering
2. `KPICard.tsx` component (see LAYOUT.md specs)
3. `IRiSInsightBanner.tsx` component
4. `DonutChart.tsx`, `LineChart.tsx`, `BarChart.tsx` using Recharts
5. `IntelligenceCard.tsx` — the "Today's Intelligence" feed cards
6. `RecentActivities.tsx` — Admin-only activity feed with tabs

**Order:**
- Admin dashboard first (most complex)
- Then Underwriter, Claims Ops, Compliance
- All use same `DashboardPage.tsx` with role-conditional sections

**Test:** Each role sees different title, KPIs, graphs, intelligence items.

---

## PHASE 4: Worklist
**Goal:** Worklist page functional for all roles (Ops = live, others = mock)

### Backend
1. `GET /iris/api/v1/worklist` — role-aware:
   - `claims_ops`: query `worklist_items` table WHERE `assigned_role = 'claims_ops'`
   - others: return mock JSON
2. `PATCH /iris/api/v1/worklist/{wl_id}` — update status

### Frontend
1. `WorklistPage.tsx` with:
   - Summary cards (7 tiles)
   - Search + filter bar
   - Quick filter pills
   - Task cards grid
2. `WorklistCard.tsx` component with priority border, time pill, badge
3. Filter logic (client-side filtering of API results)
4. Poll every 30s for claims_ops view
5. Grid/List view toggle

**Test:** Ops worklist shows WL-9202, WL-9204, WL-9206 from DB. Priority colors correct. SLA overdue shown in red.

---

## PHASE 5: Cedants Module
**Goal:** Cedants list + full detail with all 13 tabs + New Cedant wizard

### Backend
1. `GET /iris/api/v1/underwriting/cedents` — from DB + joins
2. `GET /iris/api/v1/underwriting/cedents/:id` — full object with all section data
3. `POST /iris/api/v1/underwriting/cedents` — create new
4. `PATCH /iris/api/v1/underwriting/cedents/:id/:section` — section update
5. `POST /iris/api/v1/underwriting/cedents/ai-extract` — Claude API call
6. `POST /iris/api/v1/underwriting/cedents/:id/sanction-screening` — mock screening
7. `GET /iris/api/v1/underwriting/cedents/:id/sanction-screening/history`

### Frontend
1. `CedantsPage.tsx` — table with search/filter, all columns
2. `CedantDetailPage.tsx` with `SectionPanel` component
3. Implement all 13 tabs: content per `CEDENTS.md` spec
4. `NewCedantWizard.tsx` — 13-step modal:
   - Step 0: AI document upload → `POST /ai-extract` → auto-fill subsequent steps
   - Steps 1-12: Forms per spec
   - Step 13: Summary + submit
5. Inline edit mode for each section (read-only → edit on click → save/cancel)
6. Sanction screening cards (Step 12 / Section 12)

**AI Extract integration:**
```typescript
const handleFileUpload = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const result = await api.post('/underwriting/cedents/ai-extract', formData)
  // result.extracted_fields → pre-fill form state for steps 1-12
  setExtractedFields(result.extracted_fields)
}
```

---

## PHASE 6: Contracts Module
**Goal:** Contracts list + detail with all 11 tabs

### Backend
1. `GET /iris/api/v1/underwriting/contracts` — list
2. `GET /iris/api/v1/underwriting/contracts/:id` — full detail
3. `PATCH /iris/api/v1/underwriting/contracts/:id/:section` — section update (with lock check)
4. `POST /iris/api/v1/underwriting/contracts/:id/amend` — create amendment
5. `GET /iris/api/v1/underwriting/contracts/:id/details-performance`
6. `GET /iris/api/v1/underwriting/contracts/:id/calculations`

### Frontend
1. `ContractsPage.tsx` — table, all columns
2. `ContractDetailPage.tsx` with `SectionPanel`
3. All 11 tabs: Master Data through File Templates + Operations sections
4. Lock indicator on Economic Terms + Actuarial Basis (post-inception)
5. Calculations tab: aggregation calculator with metric/aggregation/group/date dropdowns
6. Performance tab: settlement history table + KPI chips
7. Amendment modal

---

## PHASE 7: Population
**Goal:** Population screen with filters + member history

### Backend
1. `GET /iris/api/v1/underwriting/population` — with cedent/contract/status filters
2. `GET /iris/api/v1/underwriting/population/:member_id/history`
3. `PATCH /iris/api/v1/underwriting/population/:member_id/defer`

### Frontend
1. `PopulationPage.tsx` — cascading dropdowns + table
2. Member history drawer (slide-in from right)
3. Upload button → links to cession file upload flow

---

## PHASE 8: Cession File Processing
**Goal:** File queue + full 10-step pipeline modal

### Backend
1. `GET /iris/api/v1/claims/cession-files` — with metrics + queue
2. `POST /iris/api/v1/claims/cession-files/upload` — multipart
3. `GET /iris/api/v1/claims/cession-files/:id` — full detail
4. `POST /iris/api/v1/claims/cession-files/:id/pipeline/:stage` — advance stage
5. `GET /iris/api/v1/claims/cession-files/:id/pipeline-status` — poll
6. `GET /iris/api/v1/claims/cession-files/:id/summary`
7. Background task: AI classification via Claude API (Detect stage)

**AI Detect (backend service):**
```python
async def detect_file_type(filename: str, columns: list[str]) -> dict:
    prompt = f"""
    Given cession file name: {filename}
    And columns: {columns}
    Classify the file type (Pension Status, Fixed Leg, Mortality Report, Activity Report, etc.)
    and identify the cedant if possible.
    Return JSON: {{file_type: str, confidence: float, cedant: str, cedant_confidence: float, reasoning: str}}
    """
    response = anthropic_client.messages.create(...)
    return parse_json(response)
```

### Frontend
1. `CessionFilesPage.tsx` — metrics row + throughput + file queue table
2. `FileProcessingModal.tsx` — 10-step pipeline:
   - `PipelineStepBar.tsx` component
   - Each step as a separate component/view
   - Step 7 (Process): poll pipeline-status every 3s, animate progress bar
   - Step 5 (Validate): expandable table with severity/row/field/issue/suggestion
   - Step 6 (Exceptions): resolution UI per exception
3. Sample file buttons (POC demo)

---

## PHASE 9: Settlements + Calc Engine
**Goal:** Settlements list + approval + calculation engine

### Backend
1. `GET /iris/api/v1/claims/settlements` — from mock data
2. `GET /iris/api/v1/claims/settlements/:id`
3. `POST /iris/api/v1/claims/settlements/:id/approve`
4. `POST /iris/api/v1/claims/calculations/run`

### Frontend
1. `SettlementsPage.tsx` — metrics + table (mock data)
2. Settlement detail panel (slide-in) with approve/dispute buttons
3. `CalcEnginePage.tsx` — dropdowns + run button + result display

---

## PHASE 10: IRiS Chatbot
**Goal:** Floating chatbot with Claude-powered responses

### Backend
1. `POST /iris/api/v1/chatbot/message`:
   - Build system prompt (role, page, DB schema summary)
   - Pass conversation history to Claude API
   - Parse navigation intents from response
   - Return response + optional navigation action

### Frontend
1. `IRiSChatbot.tsx` — floating button + drawer
2. Message bubbles (user/assistant)
3. Navigation chip rendering
4. Persistent conversation state (in-session only, no DB)

---

## PHASE 11: Compliance (Sanctions Screening)
**Goal:** Sanctions screening page with mock data

### Frontend
1. `SanctionsPage.tsx` — KPI cards + screening status + history (all mock)
2. Cedant-level screening section (already in Cedant Detail, Phase 5)

---

## PHASE 12: Polish & Integration
- Error boundaries on all pages
- Loading skeletons throughout
- Toast notification system (success/error/warning)
- Consistent empty states
- Form validation across all wizard steps
- Responsive sidebar collapse behavior
- `README.md` in root with setup instructions

---

## Codex Prompting Tips

When generating each phase, give Codex:
1. The specific `.md` file(s) for that phase
2. The `DESIGN.md` for color/style reference
3. The `SCHEMA.md` for any DB queries
4. Tell it which phase is complete (as context)

Example prompt:
```
Build Phase 5: Cedants Module.
Reference: ui/04-underwriting/cedents/CEDENTS.md, design/DESIGN.md, db/SCHEMA.md, api/underwriting/UNDERWRITING.md
The following phases are already complete: 0,1,2,3,4
Use the established AppShell, color palette, and component patterns.
Create: CedantsPage.tsx, CedantDetailPage.tsx, NewCedantWizard.tsx
```
