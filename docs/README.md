# IRiS — Intelligent Reinsurance System
## Codex Project Documentation

> MetLife · Longevity Swap Reinsurance Platform · POC v1.0  
> Stack: React 18 + TypeScript + Vite + Tailwind · FastAPI · PostgreSQL · Anthropic Claude API

---

## How to Use This Folder in Codex

1. **Drop your UI screenshots** into `ui-screens/` (see `ui-screens/README.md` for the full list)
2. **Start with `build-plan/BUILD_PLAN.md`** — it gives the exact 12-phase build order
3. **Per phase, feed Codex:**
   - `design/DESIGN.md` — always include this (colors, fonts, all components)
   - `db/SCHEMA.md` — always include this (DB model)
   - The specific `ui/` screen spec for the page being built
   - The specific `api/` spec for the module
   - `ui/CORRECTIONS_FROM_SCREENSHOTS.md` — always include (exact values from images)
   - Relevant `ui-screens/*.png` images

---

## Folder Structure

```
IRIS_CODEX/
├── README.md                          ← You are here
│
├── ui-screens/                        ← 📁 DROP YOUR SCREENSHOTS HERE
│   └── README.md                      ← Lists all 80 expected files + Codex prompt template
│
├── architecture/
│   └── ARCHITECTURE.md                ← Tech stack, system design, folder structure, env vars
│
├── design/
│   └── DESIGN.md                      ← Color palette, fonts, spacing, every component spec
│
├── db/
│   └── SCHEMA.md                      ← 31 PostgreSQL tables with full DDL
│
├── api/
│   ├── auth/AUTH.md                   ← Login, SSO, /me, register endpoints
│   ├── dashboard/DASHBOARD.md         ← KPIs, intelligence feed, graphs, recent activities
│   ├── worklist/WORKLIST.md           ← Worklist API (role-aware)
│   ├── underwriting/UNDERWRITING.md   ← Cedants, contracts, population full CRUD
│   ├── claims/CLAIMS.md               ← Cession pipeline, settlements, calc engine
│   ├── compliance/COMPLIANCE.md       ← Sanctions, chatbot API
│   └── admin/ADMIN.md                 ← User management, integrations (mostly out of scope)
│
├── ui/
│   ├── CORRECTIONS_FROM_SCREENSHOTS.md  ← ⭐ EXACT data from every screenshot (override)
│   ├── 00-global/LAYOUT.md            ← AppShell, Sidebar, Topbar, all shared components
│   ├── 01-auth/LOGIN.md               ← Login page pixel-perfect spec
│   ├── 02-dashboard/DASHBOARD.md      ← All 4 role dashboards (Admin/UW/Ops/Compliance)
│   ├── 03-worklist/WORKLIST.md        ← Worklist page, cards, filters, role data
│   ├── 04-underwriting/
│   │   ├── cedents/CEDENTS.md         ← List + 13-tab detail + 13-step New Cedant wizard
│   │   ├── contracts/CONTRACTS.md     ← List + 14-tab detail + Population page
│   │   └── population/POPULATION.md  ← Population page quick reference
│   ├── 05-claims/
│   │   ├── cession-files/CESSION_FILES.md  ← Full 10-step pipeline modal + queue page
│   │   ├── settlements/SETTLEMENTS.md      ← Settlements list + approval flow
│   │   └── calculation-engine/CALC_ENGINE.md ← Calc engine page
│   ├── 06-compliance/SANCTIONS.md     ← Sanctions screening page
│   └── 07-admin/ADMIN.md              ← Admin module (Phase 2)
│
├── mock-data/
│   └── MOCK_DATA.md                   ← All seed JSON: users, cedants, contracts, settlements...
│
├── build-plan/
│   └── BUILD_PLAN.md                  ← 12-phase Codex build order with exact prompts
│
└── trackers/
    └── TRACKER.md                     ← Feature scope tracker (✅ working / 🟡 mock / 🔲 OOS)
```

---

## Roles Quick Reference

| Role | Dashboard | Key Modules |
|------|-----------|-------------|
| `super_admin` | All (role switcher) | Everything |
| `admin` | Admin Command Center | Integrations, users, audit |
| `underwriter` | Underwriting Command Center | Cedants, Contracts, Population |
| `claims_ops` | Claims Ops Command Center | Cession Files, Settlements, Calc Engine |
| `compliance` | Compliance Command Center | Sanctions Screening |

## Demo Login Credentials (POC)

| Email | Password | Role |
|-------|----------|------|
| admin@metlife-re.demo | admin@2026 | super_admin |
| m.patel@reinsure.io | admin@2026 | underwriter |
| a.chen@reinsure.io | admin@2026 | claims_ops |
| j.morales@reinsure.io | admin@2026 | compliance |
| d.rhodes@reinsure.io | admin@2026 | admin |

---

## POC Scope at a Glance

✅ **Working (real DB + logic):** Auth, all dashboards, ops worklist (live), cedants module, contracts module, population, full 10-step cession file pipeline, IRiS chatbot

🟡 **Mock (hardcoded JSON):** Dashboard KPIs/graphs, admin/UW/compliance worklists, settlements, calc engine, sanctions history

🔲 **Phase 2:** Compliance module, admin module, SFTP, real sanctions APIs, all 17 file types
