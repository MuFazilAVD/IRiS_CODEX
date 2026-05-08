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
| Python 3.10 backend startup compatibility | Working | Backend services now use `timezone.utc` under the existing `UTC` alias instead of importing Python 3.11-only `datetime.UTC` |
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
| Sidebar layout | Working | Role-aware sections, collapse toggle, PNG-backed MetLife logo, themed scrollbar, Phase 16 sidebar labels/items, and the underwriter `Contract Management` nav entry are implemented; the redundant claims-ops `Operations` sidebar link was removed |
| Topbar layout | Working | Environment banner, role switcher, user/logout |
| Super admin role switcher | Working | Drives role-aware dashboard/worklist payloads without limiting route access |
| Protected route skeleton | Working | All phase routes registered |
| Later-phase route placeholders | Working | Cedants, Contracts, Population, Cession Files, Settlements, Calculation Engine, Compliance Sanctions, Audit, Reports, and Admin routes are now implemented |
| IRiS chatbot | Working | Floating `IRiS Assist` drawer, Phase 16 header/copy updates, Phase 17 admin/compliance role-specific quick-action chips, route-aware location chip, expanded module navigation permissions, audit quick-action lookups seeded from `audit_events`, safe Markdown response rendering, and `/api/v1/chatbot/message` are implemented; the backend now uses the shared OpenAI client from `.env` to plan read-only SQL against the live runtime tables, execute the generated queries, repair invalid SQL once when needed, and answer from returned database context instead of the earlier hybrid hardcoded intent routing |

---

## Phase 3: Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Role-aware dashboard page | Working | Admin / Underwriter / Claims Ops / Compliance views implemented |
| KPI cards | Mock | Loaded from backend JSON by role |
| Graph sets | Mock | Loaded from backend JSON by role, with screenshot-backed two-row dashboard visual sections across admin, underwriter, claims ops, and compliance, including the Phase 17 underwriter `Population Movement` and `Renewal Pipeline` charts plus the claims-ops `Cedant File Delivery (30d)` chart |
| IRiS Insight banner | Mock | Now derived from `intelligence_feeds_complete.json` instead of static per-role copy |
| Recent Activities workspace | Mock | Screenshot-backed role-aware dashboard activity workspace now replaces the old intelligence-card section, with Team Activities / IRiS AI / Escalations tabs and backend JSON feeds for admin, underwriter, claims ops, and compliance |
| Quick action buttons | Working | Wired to navigation placeholders |
| Integration Health panel | Mock | Screenshot-backed admin second-row panel rendered from dashboard JSON |
| Pending Admin Approvals panel | Mock | Screenshot-backed admin approvals panel rendered from dashboard JSON |
| High-Risk Cedants panel | Mock | Screenshot-backed underwriter panel rendered from dashboard JSON |
| High-Impact Exceptions panel | Mock | Screenshot-backed claims-ops panel rendered from dashboard JSON |
| Active Screening Hits / Audit Heatmap | Mock | Screenshot-backed compliance second-row dashboard panels rendered from dashboard JSON |

---

## Phase 4: Worklist
| Feature | Status | Notes |
|---------|--------|-------|
| Claims Ops worklist (live DB) | Working | Live status for `WL-9202`, `WL-9204`, and `WL-9206` now overlays the shared screenshot-backed mock register so the richer card layout and cross-role accessible list stay consistent |
| Admin worklist | Mock | Admin now reads the shared 13-card screenshot-backed mock register with role-aware `Read-only` tagging instead of the earlier narrow admin-only mock subset |
| Underwriter worklist | Mock | Underwriter now reads the shared 13-card screenshot-backed mock register with role-aware `Read-only` tagging and owner/entity/impact metadata |
| Compliance worklist | Mock | Compliance now reads the shared 13-card screenshot-backed mock register including `WL-9201`, `WL-9203`, `WL-9208`, `WL-9214`, and the cross-team read-only cards |
| Summary tiles | Working | DB-backed for Claims Ops, mock for other roles |
| Search/filter | Working | Client-side filters now cover My Tasks / Team Tasks / All Accessible plus priority / status / category / source, with screenshot-style bordered controls |
| Quick filter pills | Working | Overdue / Approval / AI / Hold / High Impact |
| Grid/List view toggle | Working | Both layouts implemented, with the grid tightened to the screenshot-backed compact 3-column density and the grid cards now stretched to consistent row heights with footer anchoring |
| Claims Ops polling | Working | 30s refresh in UI |
| Worklist PATCH endpoint | Working | Backend status update route |
| Expanded card detail | Partial | Full-page worklist detail route is implemented for the screenshot-backed revised Phase 8 operations flow at `/worklist/:wlId`; broader role-specific detail experiences remain pending |
| Saved views | Not started | Future phase |

---

## Underwriting
| Feature | Status | Notes |
|---------|--------|-------|
| Cedants list page | Working | Search, status filter, screenshot-style register table, and `+ New Cedant` action implemented |
| Cedant detail page | Partial | All 13 master-data sections plus linked contracts/calculations are rendered; calculations remain a documented spec-gap placeholder, and the `Audit & Approval` timeline now reads seeded `audit_events` rows when available |
| Cedant onboarding wizard | Partial | Full 13-step UI flow implemented with stepwise persistence and AI intake; approval worklist is created on record creation because the spec does not define a separate final-submit endpoint |
| Cedant section APIs | Working | List, detail, create, section patch, status update, and sanction history routes implemented |
| Cedant AI extract | Mock | Deterministic mock extraction response, wired into the wizard upload flow |
| Cedant sanction screening | Mock | Deterministic mock screening results with source cards and history table |
| Screenshot-only cedant sub-sections | Partial | Pension Scheme, Key Contacts, and other screenshot-only detail sections persist through a mock JSON overlay because `docs/SCHEMA.md` does not define backing tables/columns |
| Contracts list page | Working | Screenshot-style register table, `+ New Contract`, and row-level view/members/amend actions implemented, with the actions cell now locked to a single inline row like the reference UI |
| Contract detail page | Partial | Revised Phase 9 V2 is implemented with the tabbed Overview / Rules & Configuration / Member Population / Financials / Amendments / Audit Log / Risk & Insights shell, settlement-linked header actions, enriched overview intelligence, and `audit_events`-backed Audit Log/Compliance Trail reads; several screenshot-only fields remain mock-backed because the SQLAlchemy layer does not yet model the full contract child tables from `docs/SCHEMA.md` |
| Contract section APIs | Working | List, detail, create, section patch, amendment, performance, calculations, member list, and upload-members routes implemented |
| Contract calculations | Mock | Calculator responses are deterministic and driven from the contract performance overlay until the later claims/calculation-engine phases provide live processing inputs |
| Contract member list | Working | Contract Detail now reads live current `policy_register` rows when population exists for the contract, including live summary counts and row-level status updates |
| Contract member upload | Working | `POST /underwriting/contracts/{contract_id}/upload-members` now imports baseline population CSV or Excel (`.xlsx`) rows into `policy_register` with SCD2 upserts and audit logging; the live upload path currently tolerates missing/invalid `date_of_birth` and `annual_pension` by reusing current member values when present and defaulting new members to placeholder values until the later enrichment phase |
| Screenshot-only contract sub-sections | Partial | Reference Pool, Actuarial Basis, Risk & Limits, Operational Terms, Audit & Compliance, and richer performance/member data persist through a documented mock JSON overlay because the current repo does not yet implement the full schema tables/models |
| Population module | Working | Policy-register-backed Population page, cascading cedent/contract filters, member history drawer, and defer endpoint are implemented |
| Population upload handoff | Working | The Population page CTA now opens the cedant/contract cascade modal and submits baseline population CSV or Excel (`.xlsx`) files through `POST /underwriting/contracts/{contract_id}/upload-members`; Claims > Cession Files remains the Pension Status processing path |
| Population `last_verified` field | Mock | The UI/API spec requires `last_verified`, but `docs/SCHEMA.md` does not define a backing column on `policy_register`, so it is served from seed/override metadata instead of invented schema |

---

## Claims
| Feature | Status | Notes |
|---------|--------|-------|
| Cession file processing | Partial | Queue page now supports the screenshot-backed full-page upload/history workflow at `/claims/cession-files/new` and `/claims/cession-files/:fileId`; upload stores source content and waits for confirmed detection/mapping before creating validation artifacts; cedent/contract detection now prioritizes strong filename matches, uses OpenAI fallback for low-confidence/conflicted matches when configured, clears downstream records/exceptions when overrides change, Pension Status CSV or Excel (`.xlsx`) files validate against confirmed-contract `policy_register` rows before applying SCD2 population updates, and Settlement files are detected by the required settlement header signature, including tab-delimited CSV aliases such as `Applicable Indexation / Escalation` and `Fee (Admin)`, before exact fixed/floating/net reconciliation; exact matches route to pending approval, while reconciliation mismatches stay in summary/worklist review rather than validation exceptions; settlement expectations skip incomplete sample `policy_register` populations and use the documented deterministic mock fallback when contract-period expected values are not tracked; richer audit presentation and contract-period expectations remain partly mock-backed where schema-tracked data is unavailable |
| Cession file queue metrics | Mock | Top metrics and throughput cards follow the API/spec baseline and layer live queue rows on top of the seeded mock counts |
| Cession file detect/map/clauses/validate stages | Working | Detect, map-contract, clauses, validate, process-exceptions, process, approve, summary, and pipeline-status endpoints are wired end to end and frontend-connected; Pension Status detection/manual override, Settlement detection/manual override, DB-derived contract clauses, pandas validation, active-member coverage checks, settlement reconciliation summary/worklist routing, data-validation exception creation, and processing now use the confirmed uploaded CSV or Excel (`.xlsx`) file plus current DB/settlement rows instead of pre-confirmation sample rows |
| Cession file summary/worklist/audit detail | Mock | The routed cession-file workflow summary/worklist/audit sections remain deterministic mock/seed payloads where the schema has no backing tables for settlement impact, commentary, or richer workflow session state; the audit section reads seeded `audit_events` rows when available |
| Settlements | Working | Screenshot-backed settlement register now uses the 7-card `Settlement & Reconciliation` summary strip, 3-chart analytics row, compact search/status/list-grid toolbar, latest-updated settlement ordering so newly created cession settlement cases appear first, seeded Q1 2025 settlement worklist rows for Northstar/Helvetia/Maple/Bavarian/Atlas, export/statement actions, the right-side detail panel, approve/hold/dispute actions, and `audit_events`-backed detail-panel audit trails |
| Calculation engine | Partial | Live contract selector and backend calculation run endpoint are implemented; screenshot-only save/submit workflow and richer audit context are deterministic UI-local mocks because the current phase spec only defines contracts list + run |

---

## Compliance
| Feature | Status | Notes |
|---------|--------|-------|
| Sanctions screening page | Working | Phase 13a is implemented with the sanctions workspace, KPI/graph panels, active-hit drawer, queued `POST /sanctions/bulk-screen`, `GET /sanctions/hits`, persisted `PATCH /sanctions/hits/{screening_ref}` resolution actions, `GET /sanctions/overview`, `GET /sanctions/cedents/{cedent_id}`, legacy `POST /sanctions/trigger`, and pipeline-facing `GET /sanctions/screen`; single-entity screening verification now uses cedent identity context from DB fields plus a mock address overlay for missing schema fields before OpenAI/fallback validation, and the active-hit drawer shows identity match/mismatch evidence; export remains a frontend-generated CSV because the compliance additions spec does not define a dedicated export endpoint |
| Audit & Traceability workspace | Working | Phase 13b is implemented at `/compliance/audit` with the screenshot-backed 10-item left nav, dashboard/search/risk-governance/data-access/reporting sections, role-gated `/api/v1/audit/*` endpoints, and mock-backed export downloads; the additions/build-plan text says 9 sub-sections, but the UI spec and screenshot include Export Audit Reports as a 10th item, so the screenshot-backed navigation was used |
| Cedant-level screening | Partial | Implemented inside Cedant Detail and the onboarding wizard; the backend single-entity watchlist verification path is now OpenAI-backed with deterministic fallback, while the broader onboarding/detail UX remains partial/mock-backed |

---

## Reports
| Feature | Status | Notes |
|---------|--------|-------|
| Report catalog + detail workspace | Working | Phase 14 is implemented with `/reports` and `/reports/:reportId`, a DB-seeded report catalog, role-filtered backend access, screenshot-backed category rail/filter panel/export actions, the tighter bordered reports-catalog visual treatment from the source screenshots, static mock detail previews, `POST /reports/export` for csv/excel/pdf/zip downloads, and generated Settlement cession output files rendered under the `Settlement Reports` category with `Operations` as the table category and row-level popup table view/download actions; the source docs fully specify 21 report rows, while 2 Debugging report definitions are missing, so the Debugging category is rendered with `0` rather than inventing undocumented entries |

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
- No remaining strict-sequence build-plan phases remain after the completed Phase 17 Polish Pass; the open backlog is now the tracker-only residual scope such as registration UI, MFA, real SSO/SAML, responsive mobile support, and broader live OpenAI rollout across the remaining mock AI experiences.
