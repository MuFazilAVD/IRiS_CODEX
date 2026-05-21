from __future__ import annotations

from dataclasses import dataclass
from html import escape
from pathlib import Path
import textwrap


OUT_DIR = Path(__file__).resolve().parent
SVG_PATH = OUT_DIR / "final-architecture.svg"
DRAWIO_PATH = OUT_DIR / "final-architecture.drawio"
NOTES_PATH = OUT_DIR / "architecture-notes.md"

WIDTH = 2200
HEIGHT = 1450

FONT_TITLE = "'Aptos Display','Segoe UI',sans-serif"
FONT_BODY = "'Aptos','Segoe UI',sans-serif"

BG = "#F4F7FB"
SURFACE = "#FFFFFF"
INK = "#17324D"
MUTED = "#5B6E82"
SOFT = "#8295A9"
BORDER = "#CAD6E3"
OUTER = "#AEC3D6"

TEAL = "#1D9AA8"
TEAL_FILL = "#E7F7F8"
BLUE = "#3A77F2"
BLUE_FILL = "#EAF1FF"
NAVY = "#24496E"
NAVY_FILL = "#ECF3F8"
GOLD = "#D79A2B"
GOLD_FILL = "#FDF4E1"
ROSE = "#D86D68"
ROSE_FILL = "#FCEAEA"
GREEN = "#2F9365"
GREEN_FILL = "#EAF7F1"
VIOLET = "#8A6BE8"
VIOLET_FILL = "#F2EDFF"
SLATE_FILL = "#F6F9FC"


@dataclass
class Box:
    id: str
    x: int
    y: int
    w: int
    h: int
    title: str
    body: list[str]
    fill: str = SURFACE
    stroke: str = BORDER
    accent: str = NAVY
    title_size: int = 22
    body_size: int = 14
    radius: int = 22
    badge: str | None = None


@dataclass
class Step:
    id: str
    number: int
    x: int
    y: int
    w: int
    h: int
    title: str
    detail: str
    accent: str
    fill: str


PANELS = [
    ("external", 60, 170, 300, 1050, "External Sources", "Cedants, TPAs, watchlists, and business consumers"),
    ("presentation", 390, 170, 1730, 160, "Presentation Layer", "Role-aware React workspace, approvals, dashboards, and operational review"),
    ("application", 390, 350, 1170, 250, "API / Service Core", "FastAPI routers, service layer, repositories, auth, and execution controls"),
    ("workflow", 390, 630, 1180, 390, "Workflow Orchestration", "Implemented cession, settlement, screening, approval, and reporting pipeline"),
    ("ai", 1590, 350, 530, 280, "AI Assistance", "OpenAI-assisted verification, SQL planning, and HITL governance"),
    ("data", 1590, 650, 530, 370, "Data and Storage", "Relational persistence, JSON workflow state, workbook cache, and generated artifacts"),
    ("governance", 390, 1040, 1730, 190, "Governance / Runtime", "Logging, audit, security, approvals, and delivery realities in the repo"),
]

BOXES = [
    Box(
        id="actors",
        x=85,
        y=220,
        w=250,
        h=165,
        title="Internal teams",
        body=[
            "Claims Ops, Underwriting, Compliance, Admin",
            "Actuarial, Finance, Cedant Relationship users",
            "Human review, approvals, overrides, case routing",
        ],
        fill=SLATE_FILL,
        accent=NAVY,
    ),
    Box(
        id="sources",
        x=85,
        y=410,
        w=250,
        h=300,
        title="Cedant and TPA inbound files",
        body=[
            "Pension Status, Settlement, Fixed Leg",
            "Mortality Report, Spouse Events, Activity Report",
            "Fee Schedule, CSV / XLSX / tab CSV / pipe TXT",
            "Routed through Claims cession upload + testcases",
        ],
        fill=BLUE_FILL,
        accent=BLUE,
        badge="real input",
    ),
    Box(
        id="watchlists",
        x=85,
        y=735,
        w=250,
        h=180,
        title="Screening sources",
        body=[
            "OFAC and FinCEN cache workbooks",
            "Editable screening workbook exports (.xlsx)",
            "Ad-hoc and cession_file sanctions cases",
        ],
        fill=GOLD_FILL,
        accent=GOLD,
        badge="cache first",
    ),
    Box(
        id="consumers",
        x=85,
        y=940,
        w=250,
        h=255,
        title="Downstream consumers",
        body=[
            "Settlement reviewers and compliance analysts",
            "Reports catalog users across Operations, Finance, Legal",
            "Contract and cedant detail workspaces",
            "IRiS Assist readers of operational and financial data",
        ],
        fill=GREEN_FILL,
        accent=GREEN,
    ),
    Box(
        id="spa",
        x=430,
        y=210,
        w=1280,
        h=90,
        title="React 19 + TypeScript + Vite SPA",
        body=[
            "TanStack Query, Axios, Zustand, React Router, Recharts, Lucide, role-based navigation, dashboard, worklist, underwriting, claims, operations, compliance, reports, admin, and IRiS Assist drawer",
        ],
        fill=BLUE_FILL,
        accent=BLUE,
        title_size=24,
        body_size=15,
        badge="frontend",
    ),
    Box(
        id="oversight",
        x=1730,
        y=210,
        w=350,
        h=90,
        title="Human oversight surfaces",
        body=[
            "Worklist queues, sanctions case review, settlement approve/hold/dispute, admin workflow-agent controls, toast/status feedback",
        ],
        fill=ROSE_FILL,
        accent=ROSE,
        title_size=22,
        body_size=15,
        badge="HITL",
    ),
    Box(
        id="routers",
        x=430,
        y=395,
        w=350,
        h=155,
        title="FastAPI /iris/api/v1 routers",
        body=[
            "auth, dashboard, underwriting, claims, operations",
            "compliance, audit, reports, admin, chatbot, worklist",
        ],
        fill=NAVY_FILL,
        accent=NAVY,
        badge="backend",
    ),
    Box(
        id="services",
        x=805,
        y=395,
        w=380,
        h=155,
        title="Service orchestration",
        body=[
            "ClaimsService, OperationsService, UnderwritingService",
            "ComplianceService, ReportsService, AuditService",
            "AdminService, WorklistService, DashboardService, ChatbotService",
        ],
        fill=TEAL_FILL,
        accent=TEAL,
        badge="business logic",
    ),
    Box(
        id="controls",
        x=1210,
        y=395,
        w=310,
        h=155,
        title="Execution controls",
        body=[
            "JWT auth, bcrypt/passlib, role gating, X-Active-Role switching",
            "SQLAlchemy repositories, schema validation, structured errors, CORS",
        ],
        fill=VIOLET_FILL,
        accent=VIOLET,
        badge="governance",
    ),
    Box(
        id="openai",
        x=1630,
        y=395,
        w=225,
        h=90,
        title="OpenAI Responses API",
        body=[
            "OPENAI_MODEL defaults to gpt-5.2 in repo config",
        ],
        fill=VIOLET_FILL,
        accent=VIOLET,
        title_size=20,
        body_size=14,
        badge="live AI",
    ),
    Box(
        id="screening_ai",
        x=1875,
        y=395,
        w=225,
        h=90,
        title="Compliance verification",
        body=[
            "Cache match -> model reasoning -> clear, pending review, or escalate",
        ],
        fill=GOLD_FILL,
        accent=GOLD,
        title_size=20,
        body_size=14,
        badge="sanctions",
    ),
    Box(
        id="chatbot_ai",
        x=1630,
        y=505,
        w=225,
        h=90,
        title="IRiS Assist SQL path",
        body=[
            "Read-only SQL plan, execute, repair once, answer from live DB context",
        ],
        fill=BLUE_FILL,
        accent=BLUE,
        title_size=20,
        body_size=14,
        badge="chatbot",
    ),
    Box(
        id="workflow_cfg",
        x=1875,
        y=505,
        w=225,
        h=90,
        title="Workflow agent controls",
        body=[
            "thresholds, retry limits, fallback mode, always_pause_for_hitl, pause behavior",
        ],
        fill=ROSE_FILL,
        accent=ROSE,
        title_size=20,
        body_size=14,
        badge="admin state",
    ),
    Box(
        id="db",
        x=1630,
        y=710,
        w=450,
        h=110,
        title="SQLAlchemy relational core",
        body=[
            "SQLite is the default runtime in this repo; DATABASE_URL supports PostgreSQL",
            "users, cedents, contracts, policy_register, cession_files, records, exceptions, settlements, worklist_items, screening_events, reports, audit_events, reference_data_versions, screening_cache_lists",
        ],
        fill=GREEN_FILL,
        accent=GREEN,
        title_size=22,
        body_size=14,
        badge="DB-backed",
    ),
    Box(
        id="json_state",
        x=1630,
        y=840,
        w=215,
        h=145,
        title="JSON workflow state",
        body=[
            "cession_pipeline_overrides.json",
            "settlement_overrides.json",
            "operations_pipeline_overrides.json",
            "admin_state.json and detail overlay stores",
        ],
        fill=GOLD_FILL,
        accent=GOLD,
        title_size=19,
        body_size=13,
        badge="mock overlay",
    ),
    Box(
        id="files_store",
        x=1865,
        y=840,
        w=215,
        h=145,
        title="Filesystem artifacts",
        body=[
            "generated_reports/settlements/",
            "Cash Settlements Tracker + GRDR load form",
            "settlement_report_artifacts.json",
            "backend/testcases and workbook downloads",
        ],
        fill=BLUE_FILL,
        accent=BLUE,
        title_size=19,
        body_size=13,
        badge="files",
    ),
    Box(
        id="log_box",
        x=430,
        y=1085,
        w=360,
        h=110,
        title="Structured logging and audit",
        body=[
            "logger.info / debug / error across services, audit_events persistence, seeded + synthesized audit history, exportable audit reports",
        ],
        fill=NAVY_FILL,
        accent=NAVY,
        title_size=21,
        body_size=14,
        badge="traceability",
    ),
    Box(
        id="sec_box",
        x=810,
        y=1085,
        w=380,
        h=110,
        title="Security and compliance controls",
        body=[
            "JWT session auth, password hashing, role-aware APIs, super-admin impersonation header, sanctions case disposition workflow, chatbot guardrails for PII and off-topic prompts",
        ],
        fill=VIOLET_FILL,
        accent=VIOLET,
        title_size=21,
        body_size=14,
        badge="RBAC",
    ),
    Box(
        id="approval_box",
        x=1210,
        y=1085,
        w=370,
        h=110,
        title="Approvals and work routing",
        body=[
            "Settlement Pending worklist items, sanctions review assignments, manual overrides, SLA-aware queues, approve/hold/dispute actions, dashboard and worklist visibility",
        ],
        fill=ROSE_FILL,
        accent=ROSE,
        title_size=21,
        body_size=14,
        badge="HITL",
    ),
    Box(
        id="runtime_box",
        x=1600,
        y=1085,
        w=480,
        h=110,
        title="Runtime reality in the repository",
        body=[
            "FastAPI BackgroundTasks + frontend polling drive async progress. No Redis, Celery, Kafka, WebSockets, Docker, Kubernetes, or IaC manifests were detected. Frontend config targets a CloudFront-hosted /iris path in deployed environments.",
        ],
        fill=SLATE_FILL,
        accent=TEAL,
        title_size=21,
        body_size=14,
        badge="current state",
    ),
    Box(
        id="agents_map",
        x=445,
        y=925,
        w=650,
        h=70,
        title="Workflow agent map",
        body=[
            "Agent steps: Detect & Map, Anomaly Detection, Resolution, Sanction Screening, File Generation | System steps: Clauses, Process, Summary, Worklist, Audit",
        ],
        fill=VIOLET_FILL,
        accent=VIOLET,
        title_size=18,
        body_size=13,
        badge="workflow_agents.py",
    ),
    Box(
        id="ops_view",
        x=1115,
        y=925,
        w=415,
        h=70,
        title="Operations V2 workspace",
        body=[
            "Normalization -> Calculations -> Variance -> Screening -> AI Decision -> Outcome, with outcome actions bridged into settlement approve/hold/reject paths",
        ],
        fill=TEAL_FILL,
        accent=TEAL,
        title_size=18,
        body_size=13,
        badge="partly JSON-backed",
    ),
]

STEPS = [
    Step("step1", 1, 445, 700, 155, 80, "File upload", "Cedant/TPA files enter the claims pipeline", BLUE, BLUE_FILL),
    Step("step2", 2, 615, 700, 155, 80, "Detect & map", "Identify file type, cedent, contract, and period", BLUE, BLUE_FILL),
    Step("step3", 3, 785, 700, 155, 80, "Validate + clauses", "pandas checks plus treaty clause retrieval", NAVY, NAVY_FILL),
    Step("step4", 4, 955, 700, 155, 80, "Adjudicate", "Anomalies, resolutions, overrides, and exceptions", ROSE, ROSE_FILL),
    Step("step5", 5, 1125, 700, 155, 80, "Compliance screen", "OFAC / FinCEN cache and OpenAI reasoning", GOLD, GOLD_FILL),
    Step("step6", 6, 1295, 700, 155, 80, "Delta detect", "Variance and exact-match reconciliation checks", GREEN, GREEN_FILL),
    Step("step7", 7, 485, 825, 175, 80, "Settlement calc", "Fixed leg, floating leg, fee, interest, net", GREEN, GREEN_FILL),
    Step("step8", 8, 680, 825, 175, 80, "BEL / A-E outputs", "Calculation views, summary, and financial impact", TEAL, TEAL_FILL),
    Step("step9", 9, 875, 825, 175, 80, "Reports + files", "CSV artifacts, report catalog entries, downloads", TEAL, TEAL_FILL),
    Step("step10", 10, 1070, 825, 175, 80, "Audit + worklist", "audit_events and routed approval tasks", NAVY, NAVY_FILL),
    Step("step11", 11, 1265, 825, 175, 80, "Human approval", "Approve/hold/dispute and UI notifications", ROSE, ROSE_FILL),
]


def wrap_line(text: str, max_chars: int) -> list[str]:
    return textwrap.wrap(text, width=max_chars, break_long_words=False, break_on_hyphens=False) or [text]


def svg_text_block(x: int, y: int, lines: list[str], size: int, fill: str, family: str = FONT_BODY, weight: int = 400, line_height: int | None = None) -> str:
    if line_height is None:
        line_height = int(size * 1.45)
    parts = [f'<text x="{x}" y="{y}" fill="{fill}" font-family="{family}" font-size="{size}" font-weight="{weight}">']
    for index, line in enumerate(lines):
        dy = "0" if index == 0 else str(line_height)
        parts.append(f'<tspan x="{x}" dy="{dy}">{escape(line)}</tspan>')
    parts.append("</text>")
    return "".join(parts)


def panel_svg(key: str, x: int, y: int, w: int, h: int, title: str, subtitle: str) -> str:
    label = key.upper().replace("_", " ")
    return (
        f'<g id="panel-{escape(key)}">'
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="30" fill="{SURFACE}" stroke="{BORDER}" stroke-width="2" filter="url(#panelShadow)"/>'
        f'<rect x="{x}" y="{y}" width="{w}" height="56" rx="30" fill="{SLATE_FILL}" stroke="none"/>'
        f'<text x="{x + 24}" y="{y + 24}" fill="{SOFT}" font-family="{FONT_BODY}" font-size="12" font-weight="700" letter-spacing="1.4">{escape(label)}</text>'
        f'<text x="{x + 24}" y="{y + 44}" fill="{INK}" font-family="{FONT_TITLE}" font-size="24" font-weight="700">{escape(title)}</text>'
        f'<text x="{x + 24}" y="{y + 72}" fill="{MUTED}" font-family="{FONT_BODY}" font-size="14">{escape(subtitle)}</text>'
        "</g>"
    )


def box_svg(box: Box) -> str:
    title_lines = wrap_line(box.title, max(18, int(box.w / 11)))
    body_lines: list[str] = []
    for body_line in box.body:
        body_lines.extend(wrap_line(body_line, max(22, int(box.w / 11))))
    parts = [
        f'<g id="{box.id}">',
        f'<rect x="{box.x}" y="{box.y}" width="{box.w}" height="{box.h}" rx="{box.radius}" fill="{box.fill}" stroke="{box.stroke}" stroke-width="1.6" filter="url(#cardShadow)"/>',
        f'<rect x="{box.x}" y="{box.y}" width="8" height="{box.h}" rx="8" fill="{box.accent}" />',
        svg_text_block(box.x + 22, box.y + 30, title_lines, box.title_size, INK, FONT_TITLE, 700),
    ]
    if box.badge:
        badge_width = max(90, min(170, len(box.badge) * 7 + 26))
        badge_x = box.x + box.w - badge_width - 16
        parts.append(
            f'<g><rect x="{badge_x}" y="{box.y + 14}" width="{badge_width}" height="24" rx="12" fill="{SURFACE}" stroke="{box.accent}" stroke-width="1.3"/>'
            f'<text x="{badge_x + 13}" y="{box.y + 31}" fill="{box.accent}" font-family="{FONT_BODY}" font-size="11" font-weight="700">{escape(box.badge.upper())}</text></g>'
        )
    parts.append(svg_text_block(box.x + 22, box.y + 68, body_lines, box.body_size, MUTED, FONT_BODY, 400))
    parts.append("</g>")
    return "".join(parts)


def chip_svg(x: int, y: int, text: str, fill: str, stroke: str, text_fill: str, width: int | None = None) -> str:
    chip_width = width or max(110, len(text) * 8 + 28)
    return (
        f'<g><rect x="{x}" y="{y}" width="{chip_width}" height="28" rx="14" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>'
        f'<text x="{x + 14}" y="{y + 19}" fill="{text_fill}" font-family="{FONT_BODY}" font-size="12" font-weight="700">{escape(text)}</text></g>'
    )


def step_svg(step: Step) -> str:
    title_lines = wrap_line(step.title, 18)
    detail_lines = wrap_line(step.detail, 28)
    return (
        f'<g id="{step.id}">'
        f'<rect x="{step.x}" y="{step.y}" width="{step.w}" height="{step.h}" rx="20" fill="{step.fill}" stroke="{step.accent}" stroke-width="1.6" filter="url(#cardShadow)"/>'
        f'<circle cx="{step.x + 22}" cy="{step.y + 22}" r="16" fill="{step.accent}"/>'
        f'<text x="{step.x + 17}" y="{step.y + 27}" fill="#FFFFFF" font-family="{FONT_BODY}" font-size="14" font-weight="700">{step.number}</text>'
        f'{svg_text_block(step.x + 46, step.y + 28, title_lines, 17, INK, FONT_TITLE, 700)}'
        f'{svg_text_block(step.x + 16, step.y + 52, detail_lines, 12, MUTED, FONT_BODY, 400, 16)}'
        "</g>"
    )


def connector(points: list[tuple[int, int]], color: str = "#2B567F", width: float = 2.2, dashed: bool = False) -> str:
    path = "M " + " L ".join(f"{x} {y}" for x, y in points)
    dash = ' stroke-dasharray="8 8"' if dashed else ""
    return f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round" opacity="0.86"{dash} marker-end="url(#arrowHead)"/>'


def build_svg() -> str:
    pieces: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" fill="none">',
        """
<defs>
  <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#F8FBFF"/>
    <stop offset="100%" stop-color="#EDF3F8"/>
  </linearGradient>
  <pattern id="dotGrid" width="28" height="28" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1.2" fill="#D8E3EE" opacity="0.55"/>
  </pattern>
  <filter id="panelShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#16324F" flood-opacity="0.08"/>
  </filter>
  <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#16324F" flood-opacity="0.07"/>
  </filter>
  <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="8.5" refY="5" orient="auto" markerUnits="userSpaceOnUse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#2B567F" opacity="0.9"/>
  </marker>
</defs>
        """,
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="url(#bgGrad)"/>',
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="url(#dotGrid)" opacity="0.33"/>',
        f'<rect x="32" y="120" width="2136" height="1288" rx="38" fill="rgba(255,255,255,0.35)" stroke="{OUTER}" stroke-width="2" stroke-dasharray="10 10"/>',
        f'<text x="60" y="72" fill="{INK}" font-family="{FONT_TITLE}" font-size="36" font-weight="700">IRIS Longevity Swap Platform Architecture</text>',
        f'<text x="60" y="102" fill="{MUTED}" font-family="{FONT_BODY}" font-size="17">Repository-grounded application view | React SPA + FastAPI service core + SQLAlchemy persistence + OpenAI-assisted review</text>',
    ]

    pieces.extend(
        [
            chip_svg(1315, 55, "React 19 / Vite 6", BLUE_FILL, BLUE, BLUE),
            chip_svg(1475, 55, "FastAPI / SQLAlchemy", TEAL_FILL, TEAL, TEAL, 190),
            chip_svg(1680, 55, "SQLite runtime / Postgres-ready", GREEN_FILL, GREEN, GREEN, 250),
            chip_svg(1945, 55, "OpenAI Responses API", VIOLET_FILL, VIOLET, VIOLET, 185),
            chip_svg(1315, 90, "DB-backed", GREEN_FILL, GREEN, GREEN, 120),
            chip_svg(1448, 90, "JSON/mock overlay", GOLD_FILL, GOLD, GOLD, 150),
            chip_svg(1612, 90, "OpenAI-assisted", VIOLET_FILL, VIOLET, VIOLET, 145),
            chip_svg(1770, 90, "Human approval", ROSE_FILL, ROSE, ROSE, 140),
            chip_svg(1924, 90, "BackgroundTasks + polling", NAVY_FILL, NAVY, NAVY, 200),
        ]
    )

    for panel in PANELS:
        pieces.append(panel_svg(*panel))

    pieces.extend(
        [
            connector([(335, 560), (390, 560), (445, 740)]),
            connector([(335, 305), (390, 305), (430, 255)]),
            connector([(335, 820), (390, 820), (1125, 740)]),
            connector([(1710, 255), (1730, 255)]),
            connector([(1710, 255), (1710, 472), (1590, 472)]),
            connector([(780, 472), (805, 472)]),
            connector([(1185, 472), (1210, 472)]),
            connector([(1330, 300), (1330, 395)]),
            connector([(1380, 472), (1590, 472)]),
            connector([(600, 740), (615, 740)]),
            connector([(770, 740), (785, 740)]),
            connector([(940, 740), (955, 740)]),
            connector([(1110, 740), (1125, 740)]),
            connector([(1280, 740), (1295, 740)]),
            connector([(1450, 740), (1450, 805), (485, 865)]),
            connector([(660, 865), (680, 865)]),
            connector([(855, 865), (875, 865)]),
            connector([(1050, 865), (1070, 865)]),
            connector([(1245, 865), (1265, 865)]),
            connector([(1202, 780), (1202, 485), (1875, 440)]),
            connector([(1400, 780), (1700, 780), (1700, 820)]),
            connector([(1040, 905), (1040, 1085)]),
            connector([(1352, 905), (1352, 1040), (1830, 1040), (1830, 1085)]),
            connector([(1600, 550), (1855, 550)]),
            connector([(1742, 595), (1742, 710)]),
            connector([(1968, 595), (1968, 710)]),
            connector([(1855, 548), (1855, 865), (1885, 865)]),
        ]
    )

    for box in BOXES:
        pieces.append(box_svg(box))

    module_y_1 = 258
    module_y_2 = 292
    module_x = [460, 600, 720, 865, 985, 1118, 1258, 1370, 1490]
    module_labels = [
        ("Dashboards", NAVY_FILL, NAVY),
        ("Worklist", TEAL_FILL, TEAL),
        ("Underwriting", BLUE_FILL, BLUE),
        ("Claims", BLUE_FILL, BLUE),
        ("Operations", TEAL_FILL, TEAL),
        ("Compliance", GOLD_FILL, GOLD),
        ("Reports", GREEN_FILL, GREEN),
        ("Admin", VIOLET_FILL, VIOLET),
        ("IRiS Assist", ROSE_FILL, ROSE),
    ]
    for x, (label, fill, stroke) in zip(module_x, module_labels):
        pieces.append(chip_svg(x, module_y_1, label, fill, stroke, stroke, 120))
    pieces.append(chip_svg(460, module_y_2, "Role-specific dashboards, drawers, tables, detail workspaces, and charts", SLATE_FILL, BORDER, MUTED, 755))

    pieces.append(
        f'<rect x="430" y="562" width="1090" height="24" rx="12" fill="{SLATE_FILL}" stroke="{BORDER}" stroke-width="1"/>'
        f'<text x="448" y="578" fill="{MUTED}" font-family="{FONT_BODY}" font-size="12" font-weight="600">Execution model: FastAPI BackgroundTasks + frontend polling. No external broker or websocket layer is implemented in the repo.</text>'
    )

    workflow_note = "Internal step ids implemented in claims: upload -> detect-map -> validate -> exceptions -> clauses -> process -> summary -> screening -> files -> worklist -> audit"
    pieces.append(
        f'<rect x="445" y="668" width="1085" height="22" rx="11" fill="{SLATE_FILL}" stroke="{BORDER}" stroke-width="1"/>'
        f'<text x="460" y="683" fill="{MUTED}" font-family="{FONT_BODY}" font-size="12" font-weight="600">{escape(workflow_note)}</text>'
    )

    for step in STEPS:
        pieces.append(step_svg(step))

    pieces.append(
        f'<text x="1632" y="618" fill="{MUTED}" font-family="{FONT_BODY}" font-size="12">Active AI paths in the codebase: sanctions verification, low-confidence detect/map fallback, and read-only chatbot SQL planning. No LangGraph, vector DB, or RAG store was detected.</text>'
    )
    pieces.append(
        f'<text x="1632" y="1007" fill="{MUTED}" font-family="{FONT_BODY}" font-size="12">JSON stores provide durable workflow state where schema-backed tables do not yet exist.</text>'
    )
    pieces.append(
        f'<text x="60" y="1375" fill="{SOFT}" font-family="{FONT_BODY}" font-size="12">Diagram reflects the repository state inspected on 2026-05-20. Items shown as JSON/mock overlay are implemented in code but not fully normalized into the relational schema.</text>'
    )
    pieces.append("</svg>")
    return "".join(pieces)


def mx_vertex(cell_id: str, value: str, x: int, y: int, w: int, h: int, fill: str, stroke: str, font_size: int = 18) -> str:
    style = (
        "rounded=1;whiteSpace=wrap;html=1;shadow=0;"
        f"fillColor={fill};strokeColor={stroke};strokeWidth=1.5;"
        f"fontColor={INK};fontSize={font_size};fontStyle=1;"
        "align=left;verticalAlign=top;spacingTop=10;spacingLeft=12;"
    )
    return (
        f'<mxCell id="{cell_id}" value="{value}" style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>'
        "</mxCell>"
    )


def mx_edge(cell_id: str, source: str, target: str) -> str:
    style = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#24496E;strokeWidth=2;endArrow=block;endFill=1;"
    return (
        f'<mxCell id="{cell_id}" style="{style}" edge="1" parent="1" source="{source}" target="{target}">'
        '<mxGeometry relative="1" as="geometry"/>'
        "</mxCell>"
    )


def drawio_value(title: str, body_lines: list[str]) -> str:
    body = "<br/>".join(escape(line) for line in body_lines)
    return f"<b>{escape(title)}</b><br/><font style=&quot;font-size:12px;color:{MUTED};&quot;>{body}</font>"


def build_drawio() -> str:
    cells = [
        '<mxCell id="0"/>',
        '<mxCell id="1" parent="0"/>',
        mx_vertex("outer", "", 32, 120, 2136, 1288, "#FFFFFF", OUTER),
    ]

    for key, x, y, w, h, title, subtitle in PANELS:
        cells.append(mx_vertex(f"panel-{key}", drawio_value(title, [subtitle]), x, y, w, h, SURFACE, BORDER, 22))

    for box in BOXES:
        cells.append(mx_vertex(box.id, drawio_value(box.title, box.body), box.x, box.y, box.w, box.h, box.fill, box.accent, 18))

    for step in STEPS:
        cells.append(mx_vertex(step.id, drawio_value(f"{step.number}. {step.title}", [step.detail]), step.x, step.y, step.w, step.h, step.fill, step.accent, 16))

    cells.extend(
        [
            mx_edge("edge1", "actors", "spa"),
            mx_edge("edge2", "sources", "step1"),
            mx_edge("edge3", "watchlists", "screening_ai"),
            mx_edge("edge4", "spa", "routers"),
            mx_edge("edge5", "routers", "services"),
            mx_edge("edge6", "services", "controls"),
            mx_edge("edge7", "services", "step2"),
            mx_edge("edge8", "step4", "step5"),
            mx_edge("edge9", "step5", "screening_ai"),
            mx_edge("edge10", "openai", "screening_ai"),
            mx_edge("edge11", "openai", "chatbot_ai"),
            mx_edge("edge12", "workflow_cfg", "agents_map"),
            mx_edge("edge13", "step6", "step7"),
            mx_edge("edge14", "step7", "step8"),
            mx_edge("edge15", "step8", "step9"),
            mx_edge("edge16", "step9", "db"),
            mx_edge("edge17", "step9", "files_store"),
            mx_edge("edge18", "step10", "approval_box"),
            mx_edge("edge19", "step11", "oversight"),
            mx_edge("edge20", "chatbot_ai", "db"),
            mx_edge("edge21", "services", "db"),
            mx_edge("edge22", "services", "json_state"),
            mx_edge("edge23", "log_box", "runtime_box"),
        ]
    )

    root = "".join(cells)
    return (
        '<mxfile host="app.diagrams.net" modified="2026-05-20T00:00:00Z" agent="Codex" version="24.7.17" type="device">'
        '<diagram id="iris-architecture" name="IRIS Architecture">'
        f'<mxGraphModel dx="1800" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{WIDTH}" pageHeight="{HEIGHT}" math="0" shadow="0"><root>{root}</root></mxGraphModel>'
        "</diagram></mxfile>"
    )


def build_notes() -> str:
    return """# IRIS architecture notes

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
"""


def main() -> None:
    SVG_PATH.write_text(build_svg(), encoding="utf-8")
    DRAWIO_PATH.write_text(build_drawio(), encoding="utf-8")
    NOTES_PATH.write_text(build_notes(), encoding="utf-8")


if __name__ == "__main__":
    main()
