# IRiS - Feature Tracker

## Status Legend
- `Working`
- `Mock`
- `Partial`
- `Not started`

> Tracker reset to the actual repository state on 2026-05-05. The repo was greenfield at build start, so this file reflects the code that exists in `frontend/` and `backend/`, not earlier documentation-only assumptions.

---

## Phase 0-1: Foundation + Auth
| Feature | Status | Notes |
|---------|--------|-------|
| Frontend scaffold (Vite + React + TS) | Working | `frontend/` created |
| Backend scaffold (FastAPI + SQLAlchemy) | Working | `backend/` created |
| Tailwind + design token foundation | Working | Colors, spacing, shared utility classes, and shell layout tokens added |
| Root health endpoint | Working | `GET /` returns `{"status":"ok","version":"1.0.0"}` |
| Login with email/password | Working | Seeded demo users authenticate, persist JWT sessions, and only redirect into the workspace after the restored session is revalidated |
| Mock SSO button | Mock | Returns seeded `super_admin` session |
| `GET /api/v1/auth/me` | Working | JWT decode and user lookup |
| JWT-protected app routes | Working | ProtectedRoute now validates persisted sessions through `GET /api/v1/auth/me` before rendering protected pages, and frontend `401` responses clear stale auth back to `/login` |
| Logout | Working | Clears persisted auth state |
| User registration UI | Not started | Backend endpoint exists, no UI yet |
| MFA | Not started | Future phase |
| Real SSO / SAML | Not started | Future phase |

---

## Phase 2: App Shell + Navigation
| Feature | Status | Notes |
|---------|--------|-------|
| Sidebar layout | Working | Role-aware sections, collapse toggle, PNG-backed MetLife logo, themed scrollbar |
| Topbar layout | Working | Environment banner, role switcher, user/logout |
| Super admin role switcher | Working | Drives role-aware dashboard/worklist payloads without limiting route access |
| Protected route skeleton | Working | All phase routes registered |
| Later-phase route placeholders | Working | Cedants, Contracts, Population, Cession Files, Settlements, Calculation Engine, Compliance Sanctions, Audit, Reports, and Admin routes are now implemented |
| IRiS chatbot | Partial | Floating `IRiS Assist` drawer, role-aware quick actions, navigation chips, and `/api/v1/chatbot/message` are implemented; responses are deterministic mock/live-lookup hybrids because the current repo path does not include a live Claude integration |

---

## Phase 3: Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Role-aware dashboard page | Working | Admin / Underwriter / Claims Ops / Compliance views implemented |
| KPI cards | Mock | Loaded from backend JSON by role |
| Graph sets | Mock | Loaded from backend JSON by role |
| IRiS Insight banner | Mock | Mock text by role |
| Today's Intelligence cards | Mock | Mock feed by role |
| Admin recent activities feed | Mock | Mock activity payload rendered |
| Quick action buttons | Working | Wired to navigation placeholders |
| Integration Health panel | Not started | Pending |
| Pending Admin Approvals panel | Not started | Pending |
| High-Risk Cedants panel | Not started | Pending |
| High-Impact Exceptions panel | Not started | Pending |
| Active Screening Hits / Audit Heatmap | Not started | Pending |

---

## Phase 4: Worklist
| Feature | Status | Notes |
|---------|--------|-------|
| Claims Ops worklist (live DB) | Working | Seeded with `WL-9202`, `WL-9204`, `WL-9206` |
| Admin worklist | Mock | Mock JSON |
| Underwriter worklist | Mock | Mock JSON |
| Compliance worklist | Mock | Mock JSON |
| Summary tiles | Working | DB-backed for Claims Ops, mock for other roles |
| Search/filter | Working | Client-side |
| Quick filter pills | Working | Overdue / Approval / AI / Hold |
| Grid/List view toggle | Working | Both layouts implemented |
| Claims Ops polling | Working | 30s refresh in UI |
| Worklist PATCH endpoint | Working | Backend status update route |
| Expanded card detail | Partial | Full-page worklist detail route is implemented for the screenshot-backed revised Phase 8 operations flow at `/worklist/:wlId`; broader role-specific detail experiences remain pending |
| Saved views | Not started | Future phase |

---

## Underwriting
| Feature | Status | Notes |
|---------|--------|-------|
| Cedants list page | Working | Search, status filter, screenshot-style register table, and `+ New Cedant` action implemented |
| Cedant detail page | Partial | All 13 master-data sections plus linked contracts/calculations are rendered; calculations remain a documented spec-gap placeholder |
| Cedant onboarding wizard | Partial | Full 13-step UI flow implemented with stepwise persistence and AI intake; approval worklist is created on record creation because the spec does not define a separate final-submit endpoint |
| Cedant section APIs | Working | List, detail, create, section patch, status update, and sanction history routes implemented |
| Cedant AI extract | Mock | Deterministic mock extraction response, wired into the wizard upload flow |
| Cedant sanction screening | Mock | Deterministic mock screening results with source cards and history table |
| Screenshot-only cedant sub-sections | Partial | Pension Scheme, Key Contacts, and other screenshot-only detail sections persist through a mock JSON overlay because `docs/SCHEMA.md` does not define backing tables/columns |
| Contracts list page | Working | Screenshot-style register table, `+ New Contract`, and row-level view/members/amend actions implemented |
| Contract detail page | Partial | Revised Phase 9 V2 is implemented with the tabbed Overview / Rules & Configuration / Member Population / Financials / Amendments / Audit Log / Risk & Insights shell, settlement-linked header actions, and enriched overview intelligence; several screenshot-only fields remain mock-backed because the SQLAlchemy layer does not yet model the full contract child tables from `docs/SCHEMA.md` |
| Contract section APIs | Working | List, detail, create, section patch, amendment, performance, calculations, member list, and upload-members routes implemented |
| Contract calculations | Mock | Calculator responses are deterministic and driven from the contract performance overlay until the later claims/calculation-engine phases provide live processing inputs |
| Contract member list | Mock | Contract Detail still renders the earlier deterministic inline member sample, but its row actions now deep-link into the live Population module |
| Contract member upload | Mock | Upload endpoint is wired and audited, but stores a deterministic mock acceptance response until the Population / cession-file pipeline phase is built |
| Screenshot-only contract sub-sections | Partial | Reference Pool, Actuarial Basis, Risk & Limits, Operational Terms, Audit & Compliance, and richer performance/member data persist through a documented mock JSON overlay because the current repo does not yet implement the full schema tables/models |
| Population module | Working | Policy-register-backed Population page, cascading cedent/contract filters, member history drawer, and defer endpoint are implemented |
| Population upload handoff | Mock | `Upload cedant file` is a documented stub because the cession-file pipeline belongs to the next build-plan phase and the upload API contract does not exist yet |
| Population `last_verified` field | Mock | The UI/API spec requires `last_verified`, but `docs/SCHEMA.md` does not define a backing column on `policy_register`, so it is served from seed/override metadata instead of invented schema |

---

## Claims
| Feature | Status | Notes |
|---------|--------|-------|
| Cession file processing | Partial | Queue page now supports both the legacy upload/historical intake flow and the revised V2 Active Pipelines flow; `/operations/:process_id` full-page six-step workflow is implemented, while upload/history remain on the legacy modal because the revised spec does not redefine that intake flow |
| Cession file queue metrics | Mock | Top metrics and throughput cards follow the API/spec baseline and layer live queue rows on top of the seeded mock counts |
| Cession file detect/map/clauses/validate stages | Working | Detect, map-contract, clauses, validate, process-exceptions, process, approve, summary, and pipeline-status endpoints are wired end to end and frontend-connected |
| Cession file summary/worklist/audit detail | Mock | Legacy modal summary/worklist/audit detail plus the revised V2 operations step content are rendered from deterministic mock/seed data where the schema has no backing tables for settlement impact, audit payload shape, pipeline commentary, or richer workflow session payloads |
| Settlements | Working | Revised Phase 9 V2 settlement register is implemented with the 4 KPI row, search/filter row, settlement table, right-side detail panel, approve/hold/dispute actions, and direct pipeline-outcome handoff into the mock-backed settlement register via JSON override state |
| Calculation engine | Partial | Live contract selector and backend calculation run endpoint are implemented; screenshot-only save/submit workflow and richer audit context are deterministic UI-local mocks because the current phase spec only defines contracts list + run |

---

## Compliance
| Feature | Status | Notes |
|---------|--------|-------|
| Sanctions screening page | Working | Phase 13a is implemented with the sanctions workspace, KPI/graph panels, active-hit drawer, queued `POST /sanctions/bulk-screen`, `GET /sanctions/hits`, persisted `PATCH /sanctions/hits/{screening_ref}` resolution actions, `GET /sanctions/overview`, `GET /sanctions/cedents/{cedent_id}`, legacy `POST /sanctions/trigger`, and pipeline-facing `GET /sanctions/screen`; export remains a frontend-generated CSV because the compliance additions spec does not define a dedicated export endpoint |
| Audit & Traceability workspace | Working | Phase 13b is implemented at `/compliance/audit` with the screenshot-backed 10-item left nav, dashboard/search/risk-governance/data-access/reporting sections, role-gated `/api/v1/audit/*` endpoints, and mock-backed export downloads; the additions/build-plan text says 9 sub-sections, but the UI spec and screenshot include Export Audit Reports as a 10th item, so the screenshot-backed navigation was used |
| Cedant-level screening | Partial | Implemented inside Cedant Detail and the onboarding wizard as mock-backed flows |

---

## Reports
| Feature | Status | Notes |
|---------|--------|-------|
| Report catalog + detail workspace | Working | Phase 14 is implemented with `/reports` and `/reports/:reportId`, a DB-seeded report catalog, role-filtered backend access, screenshot-backed category rail/filter panel/export actions, static mock detail previews, and `POST /reports/export` for csv/excel/pdf/zip downloads; the source docs fully specify 21 report rows, while 2 Debugging report definitions are missing, so the Debugging category is rendered with `0` rather than inventing undocumented entries |

---

## Admin
| Feature | Status | Notes |
|---------|--------|-------|
| Admin workflow screens | Working | Phase 15 is complete: `/admin/users` and `/admin/library` are implemented with screenshot-aligned tabs, modals, drawers, and sidebar routing; users flow reads/writes the `users` table, permissions and approval matrix remain deliberate static POC responses per the spec, access logs now read from seeded `audit_events`, and the reference library now reads from seeded `reference_data_versions` plus `screening_cache_lists` tables |
| User management UI | Working | Users list, create invite, role/status edit, revoke flow, temp-password response, and the six Phase 15 seed users are aligned to `/api/v1/admin/users*` |

---

## Global
| Feature | Status | Notes |
|---------|--------|-------|
| Desktop-first layout | Working | Shared shell and content density tuned for 1024px+ |
| Error boundaries on all pages | Working | Global app-level and route-resetting page-level React error boundaries now wrap login and protected workspace rendering, with branded retry/dashboard/refresh fallbacks |
| Loading skeletons throughout | Partial | Shared shimmer skeleton components are implemented and wired into dashboard, worklist, cedants, contracts, settlements, and admin users/library list states; some secondary detail panels and drawers still use plain loading copy |
| Toast notification system | Working | Global toast store + viewport are mounted app-wide and now handle action feedback across admin users/library, sanctions, population, calculation engine, and settlement workbench flows instead of page-local inline banners |
| Consistent empty states | Partial | Shared empty-state and table-row components now cover worklist, cedants, contracts, population, cession files, settlements, admin library, and shared DataTable consumers; some deeper detail tabs still retain older inline empty copy |
| Responsive mobile support | Not started | Out of current scope |
| Structured backend logging | Working | Service-layer info/debug/error logging added, including underwriting and claims services |
| Frontend production build | Working | `npm run build` passes |
| Backend smoke verification | Working | Health, auth, dashboard, worklist, underwriting cedants/contracts/population including contract detail V2 performance enrichments, claims cession-file queue/detail/upload/pipeline/summary, operations pipelines/detail/step/advance/abort/resolve including outcome-to-settlement approval, settlements/detail/approve/hold/dispute, calculation contracts/run, compliance sanctions overview/detail/trigger/bulk-screen/hits/resolve/screen, audit dashboard/search/financial-impact/approvals/ai-decisions/manual-overrides/reference-data/access-logs/document-history/export-reports/download, reports catalog/detail/export with role-filtering checks, admin users/permissions/approval-matrix/audit-log/library/upload/sync, and chatbot message endpoints verified |

---

## Next Build Unit
- Phase 16: Navigation + Sidebar Updates, as the next strict-sequence unit after the completed Administration Module follow-through.
