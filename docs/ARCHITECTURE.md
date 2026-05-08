# IRiS — System Architecture

## Overview

IRiS is a single-tenant, role-based web application. The frontend is a React SPA. The backend is a FastAPI REST API. All data lives in PostgreSQL. AI features call the Anthropic Claude API server-side.

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (React SPA)                  │
│  React 18 · TypeScript · Vite · Tailwind · Recharts      │
│  React Router v6 · React Query (TanStack) · Zustand      │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS / REST JSON
┌───────────────────────▼─────────────────────────────────┐
│                    FastAPI Backend                        │
│  Python 3.11 · SQLAlchemy · Alembic · Pydantic           │
│  JWT Auth middleware · Role-based route guards            │
│  Background tasks (file processing pipeline)             │
└──────┬───────────────────────────┬──────────────────────┘
       │                           │
┌──────▼──────┐           ┌────────▼───────┐
│ PostgreSQL  │           │ Anthropic API  │
│ (Primary DB)│           │ Claude Sonnet  │
│             │           │ - Doc extract  │
│ All tables  │           │ - File detect  │
│ See SCHEMA  │           │ - Chatbot      │
└─────────────┘           └────────────────┘
```

## Frontend Structure

```
src/
├── main.tsx
├── App.tsx                    # Router setup
├── store/
│   ├── authStore.ts           # Zustand: user, role, token
│   └── uiStore.ts             # Zustand: sidebar, chatbot open state
├── api/
│   └── client.ts              # Axios instance with JWT interceptor
├── hooks/
│   ├── useAuth.ts
│   ├── useDashboard.ts
│   ├── useWorklist.ts
│   └── ...                    # One hook per major feature
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx       # Sidebar + topbar wrapper
│   │   ├── Sidebar.tsx        # Role-aware nav
│   │   └── Topbar.tsx         # Role switcher, user avatar
│   ├── common/
│   │   ├── KPICard.tsx
│   │   ├── DataTable.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── PageHeader.tsx
│   │   └── IRiSChatbot.tsx    # Floating chatbot button + drawer
│   └── charts/
│       ├── DonutChart.tsx
│       ├── LineChart.tsx
│       └── BarChart.tsx
├── pages/
│   ├── auth/
│   │   └── LoginPage.tsx
│   ├── dashboard/
│   │   └── DashboardPage.tsx  # Renders role-specific view
│   ├── worklist/
│   │   └── WorklistPage.tsx
│   ├── underwriting/
│   │   ├── cedents/
│   │   │   ├── CedentsPage.tsx
│   │   │   ├── CedentDetailPage.tsx
│   │   │   └── NewCedentWizard.tsx
│   │   ├── contracts/
│   │   │   ├── ContractsPage.tsx
│   │   │   └── ContractDetailPage.tsx
│   │   └── population/
│   │       └── PopulationPage.tsx
│   ├── claims/
│   │   ├── cession/
│   │   │   ├── CessionFilesPage.tsx
│   │   │   └── FileProcessingModal.tsx
│   │   ├── settlements/
│   │   │   └── SettlementsPage.tsx
│   │   └── calculation/
│   │       └── CalcEnginePage.tsx
│   └── compliance/
│       └── SanctionsPage.tsx
└── utils/
    ├── formatters.ts
    ├── roleGuard.ts
    └── constants.ts
```

## Backend Structure

```
app/
├── main.py                    # FastAPI app factory
├── config.py                  # Settings (env vars)
├── database.py                # SQLAlchemy session
├── models/                    # SQLAlchemy ORM models (mirrors SCHEMA.md)
│   ├── user.py
│   ├── cedent.py
│   ├── contract.py
│   ├── population.py
│   ├── cession_file.py
│   ├── settlement.py
│   ├── worklist.py
│   └── screening.py
├── schemas/                   # Pydantic request/response models
├── routers/                   # FastAPI routers (one per module)
│   ├── auth.py
│   ├── dashboard.py
│   ├── worklist.py
│   ├── cedents.py
│   ├── contracts.py
│   ├── population.py
│   ├── cession_files.py
│   ├── settlements.py
│   ├── calculations.py
│   ├── compliance.py
│   └── chatbot.py
├── services/                  # Business logic
│   ├── auth_service.py
│   ├── ai_service.py          # Anthropic API calls
│   ├── file_pipeline.py       # 10-step cession file pipeline
│   ├── settlement_calc.py     # Settlement calculations
│   └── screening_service.py   # Sanctions screening
├── mock_data/                 # Hardcoded JSON for POC
│   ├── dashboard_kpis.json
│   ├── intelligence_feeds.json
│   └── graph_data.json
└── migrations/                # Alembic
```

## Role-Based Access Control

```python
ROLE_PERMISSIONS = {
    "super_admin": ["*"],                          # all
    "admin": ["dashboard", "worklist", "admin.*"],
    "underwriter": ["dashboard", "worklist", "underwriting.*"],
    "claims_ops": ["dashboard", "worklist", "claims.*"],
    "compliance": ["dashboard", "worklist", "compliance.*"],
}
```

Route guard in FastAPI: `Depends(require_role(["underwriter", "super_admin"]))`  
Route guard in React: `<RoleGate roles={["underwriter", "super_admin"]} />`

## Navigation Structure (Sidebar)

```
Operations (section label)
  ├── Dashboard
  └── Worklist

Underwriting (section label — visible to underwriter, super_admin)
  ├── Cedants
  ├── Contracts
  └── Population

Claims & Settlement (section label — visible to claims_ops, super_admin)
  ├── Cession Files
  ├── Settlements
  └── Calculation Engine

Compliance & Audit (section label — visible to compliance, super_admin)
  └── Sanctions Screening
```

## Key Architectural Decisions

1. **Fixed Leg Schedule is immutable** — stored as locked rows, update endpoint returns 403 post-inception
2. **Policy Register uses SCD2** — `effective_from` / `effective_to` columns, never hard-delete
3. **File processing pipeline is async** — FastAPI BackgroundTasks, status polled by frontend every 3s
4. **All AI calls are server-side** — API key never leaves backend
5. **Mock data served from JSON** — dashboards, graphs, intelligence feeds read from `/mock_data/*.json`
6. **Worklist for Ops is real** — `worklist_items` table, filtered by `assigned_role = 'claims_ops'`
7. **Deployment API path is prefixed** — API v1 routes mount at `/iris/api/v1` by default for the CloudFront deployment path.
8. **CORS is open for deployment** — backend CORS allows all origins, methods, and headers.

## Environment Variables

```env
DATABASE_URL=postgresql://iris:password@localhost:5432/iris_db
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=super-secret-key
JWT_EXPIRE_MINUTES=480
ENVIRONMENT=development
API_V1_PREFIX=/iris/api/v1
VITE_BACKEND_URL=http://d3sok4f0t46eww.cloudfront.net/iris
```
