# IRIS architecture notes

## 1. Architecture overview
IRIS is implemented as a modular full-stack application rather than a distributed microservice estate. The frontend is a React 19 + TypeScript + Vite single-page app. The backend is a FastAPI application organized by router -> service -> repository layers. Core operational data is persisted through SQLAlchemy models, while several workflow-session and screenshot-only enrichments are intentionally stored in JSON override files where the schema does not yet provide first-class tables.

The platform is therefore best described as an enterprise workflow application with selective AI assistance, human-in-the-loop control, and a mixed persistence model:

- Relational tables hold the canonical operational registers.
- JSON state stores hold orchestration/runtime overlays and mock-backed detail enrichments.
- Filesystem artifacts hold generated settlement outputs and downloadable workbook assets.

## 2. Layer explanations
### External actors and data sources
- Cedants and TPAs provide the inbound cession files that drive the claims workflow.
- Internal users operate the system through role-specific dashboards, worklists, review queues, and reporting workspaces.
- Screening inputs are sourced from cached OFAC and FinCEN workbook data that can be edited and re-exported from the product.

### Presentation layer
- The frontend uses React 19, TypeScript, Vite, TanStack Query, Zustand, Axios, React Router, Recharts, Lucide, and Phosphor icons.
- Implemented workspaces include dashboard, worklist, underwriting, claims, operations, compliance, reports, admin, and the IRiS Assist drawer.
- Human review is surfaced directly in the UI through settlement approvals, sanctions dispositions, worklist routing, and workflow-agent controls.

### API and application layer
- The backend exposes `/iris/api/v1` through FastAPI.
- Implemented routers include `auth`, `dashboard`, `underwriting`, `claims`, `operations`, `compliance`, `audit`, `reports`, `admin`, `chatbot`, and `worklist`.
- The service layer contains the real orchestration logic. The largest workflow engine is `ClaimsService`, which coordinates cession processing, settlement reconciliation, workflow state, agent pauses, worklist creation, and audit persistence.

### AI and operational intelligence layer
- Live AI integration in the current codebase uses OpenAI, not Anthropic, for the active review experiences.
- OpenAI is used in three places:
  - sanctions verification in `ComplianceService`
  - low-confidence detect/map fallback in the claims pipeline
  - read-only SQL planning and answer generation in `ChatbotService`
- The chatbot path is guarded by read-only SQL enforcement plus off-topic and PII restrictions.

### Workflow and orchestration layer
- The cession workflow is implemented in-process inside `ClaimsService`.
- Workflow configuration is defined in `backend/app/workflow_agents.py` and persisted for admin control in `backend/app/mock_data/admin_state.json`.
- Agent steps are `Detect & Map`, `Anomaly Detection`, `Resolution`, `Sanction Screening`, and `File Generation`.
- System steps are `Clauses`, `Process`, `Summary`, `Worklist`, and `Audit`.
- Async execution uses FastAPI `BackgroundTasks` plus frontend polling. No external broker, queue product, or workflow engine is present in the repo.

### Data and storage layer
- The runtime database defaults to local SQLite through `backend/app/config.py`.
- The repo also supports PostgreSQL by environment configuration, but the inspected workspace defaults to SQLite.
- Canonical tables include users, cedents, contracts, policy register rows, cession files, cession records, cession exceptions, settlements, worklist items, screening events, reports, audit events, reference data versions, and screening cache lists.
- JSON stores hold orchestration overlays such as cession pipeline state, settlement overrides, operations-pipeline detail, and admin workflow-agent controls.
- Filesystem artifacts include generated settlement CSVs, workbook downloads, and curated test files.

## 3. Workflow explanation
The implemented end-to-end business flow is:

1. Cedant or TPA file upload enters the claims queue.
2. The pipeline detects file type, cedent, contract, and processing period.
3. Uploaded rows are validated and mapped against contract clauses and current data expectations.
4. Anomalies are adjudicated through automated resolutions or manual override paths.
5. Counterparties are screened against OFAC / FinCEN cache data, with OpenAI reasoning used when a retained hit needs verification.
6. Settlement files pass through exact-match and variance checks so the platform can determine whether the uploaded results match IRIS expectations.
7. The settlement engine computes or reconciles fixed leg, floating leg, fee, interest, and net settlement values.
8. Business outputs are surfaced through summary, A/E, BEL-oriented, and reporting views; generated files are prepared for downstream consumption.
9. The workflow persists audit records and routes operational tasks into the worklist.
10. Humans approve, hold, dispute, or disposition settlement and compliance cases.
11. The UI reflects outcome through queues, detail workspaces, dashboard refresh, and toast notifications.

The separate Operations V2 page is a presentation and review layer over this domain. It exposes `Normalization -> Calculations -> Variance -> Screening -> AI Decision -> Outcome` and can bridge final actions into settlement approval paths.

## 4. Technology stack summary
- Frontend: React 19, TypeScript, Vite 6, Tailwind CSS, TanStack Query, Axios, Zustand, React Router, Recharts
- Backend: FastAPI, Uvicorn, SQLAlchemy, Alembic, Pydantic-style request/response schemas, `python-jose`, `passlib`, `pandas`, `openpyxl`
- Persistence: SQLite runtime by default; PostgreSQL-compatible configuration via env
- AI: OpenAI Responses API with `OPENAI_MODEL` defaulting to `gpt-5.2`
- File handling: CSV / XLSX parsing, generated settlement CSV artifacts, editable workbook exports
- Auth and security: JWT sessions, password hashing, role-based access, super-admin role switching

## 5. Key design decisions
- The platform favors a modular monolith over distributed services. This keeps the domain workflow close to the data and avoids premature operational complexity.
- Workflow state is mixed-mode: canonical business registers are relational, while orchestration/session details remain JSON-backed until the schema catches up.
- Human-in-the-loop controls are first-class. The workflow can pause based on confidence thresholds, explicit `always_pause_for_hitl`, or sanction review requirements.
- The system uses AI sparingly and in bounded paths instead of turning the application into a free-form agent platform.

## 6. AI orchestration explanation
AI orchestration in the current repository is application-managed rather than framework-managed:

- `ClaimsService` sequences the workflow and records per-step runtime state.
- `workflow_agents.py` defines which steps are agentic versus system-driven.
- Admin users can control enablement, confidence threshold, retry limit, fallback mode, and forced manual review behavior.
- Compliance screening uses a cache-first strategy:
  - first-pass keyword or fuzzy matching against screening cache data
  - OpenAI reasoning only when retained matches need verification
  - persisted `screening_events` and case review if human intervention is required
- The chatbot uses AI for question planning and SQL generation, but the execution path is constrained to read-only database access.

## 7. Scalability considerations
The current implementation is strong for a controlled enterprise POC or internal operations platform, but the following scale-out points are clear:

- Move workflow-session state from JSON files into durable tables or an explicit workflow store.
- Externalize large generated artifacts and inbound file blobs into object storage.
- Replace BackgroundTasks + polling with a broker-backed worker model if throughput or concurrency materially increases.
- Add infra-as-code, containerization, and deployment automation because they are not present in the inspected repository.

## 8. Security and compliance architecture
- Authentication is JWT-based with hashed passwords and role-aware API enforcement.
- Compliance controls include sanctions case history, workbook provenance, audit events, and disposition review.
- The chatbot includes business-scope and PII guardrails.
- Audit visibility is implemented across worklist, compliance, settlements, admin access logs, and exportable reports.

## 9. Why this architecture fits longevity swap processing
Longevity swap operations require deterministic financial workflows, clear exception handling, and strong auditability more than they require a fully autonomous agent mesh. The current IRIS architecture fits that need well:

- financial registers and settlement outcomes stay close to a relational source of truth
- file ingestion and adjudication logic is explicit and inspectable
- sanctions, audit, and approval checkpoints are embedded directly into operations
- AI is used to accelerate review and analysis without replacing human sign-off

That combination is appropriate for a longevity swap platform where explainability, settlement control, and compliance traceability matter as much as automation.

## 10. Current implementation boundaries
- The docs describe broader cloud and data-platform aspirations, but the inspected repository does not contain Docker, Kubernetes, Terraform, Redis, Celery, Kafka, LangGraph, LangChain, vector search, or websocket infrastructure.
- The `anthropic` package remains in backend dependencies and older docs reference Claude, but the active implemented AI paths in code use OpenAI.
- Several richer audit, operations, and reporting surfaces remain intentionally mock-backed where the current schema does not yet define all of the screenshot-driven detail fields.
