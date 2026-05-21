from __future__ import annotations

from dataclasses import dataclass
from html import escape
from pathlib import Path
import textwrap


OUT_DIR = Path(__file__).resolve().parent
SVG_PATH = OUT_DIR / "final-enterprise-architecture.svg"
DRAWIO_PATH = OUT_DIR / "final-enterprise-architecture.drawio"
SUMMARY_PATH = OUT_DIR / "architecture-summary.md"

WIDTH = 2200
HEIGHT = 1320

FONT_TITLE = "'Aptos Display','Segoe UI',sans-serif"
FONT_BODY = "'Aptos','Segoe UI',sans-serif"

BG = "#F4F7FB"
SURFACE = "#FFFFFF"
INK = "#16324D"
MUTED = "#597087"
SOFT = "#8397AB"
BORDER = "#CAD7E5"
OUTER = "#B5C8D9"
SLATE = "#6A7F94"
SLATE_FILL = "#F3F7FB"
BLUE = "#3A77F2"
BLUE_FILL = "#EBF2FF"
TEAL = "#1593A5"
TEAL_FILL = "#E7F8F9"
GREEN = "#2E9964"
GREEN_FILL = "#EAF8F0"
GOLD = "#D79A2B"
GOLD_FILL = "#FDF4E3"
ROSE = "#DB7066"
ROSE_FILL = "#FDECEA"
VIOLET = "#8266E8"
VIOLET_FILL = "#F2EEFF"


@dataclass
class Stage:
    number: int
    title: str
    kind: str


STAGES = [
    Stage(1, "File Upload", "system"),
    Stage(2, "Detection & Mapping", "agent"),
    Stage(3, "Anomaly Detection", "agent"),
    Stage(4, "Resolution Generation", "agent"),
    Stage(5, "Clauses Retrieval", "system"),
    Stage(6, "Process Settlement", "system"),
    Stage(7, "Summary Generation", "system"),
    Stage(8, "Sanction Screening", "agent"),
    Stage(9, "Downstream Files", "agent"),
    Stage(10, "Worklist Generation", "system"),
    Stage(11, "Audit Trail Generation", "system"),
]


def wrap_line(text: str, width: int) -> list[str]:
    return textwrap.wrap(text, width=width, break_long_words=False, break_on_hyphens=False) or [text]


def svg_text(x: int, y: int, lines: list[str], size: int, fill: str, family: str = FONT_BODY, weight: int = 400, line_height: int | None = None) -> str:
    if line_height is None:
        line_height = int(size * 1.42)
    parts = [f'<text x="{x}" y="{y}" fill="{fill}" font-family="{family}" font-size="{size}" font-weight="{weight}">']
    for index, line in enumerate(lines):
        dy = "0" if index == 0 else str(line_height)
        parts.append(f'<tspan x="{x}" dy="{dy}">{escape(line)}</tspan>')
    parts.append("</text>")
    return "".join(parts)


def chip(x: int, y: int, text: str, fill: str, stroke: str, text_fill: str, width: int | None = None, height: int = 30, size: int = 12) -> str:
    chip_width = width or max(92, len(text) * 8 + 28)
    return (
        f'<g><rect x="{x}" y="{y}" width="{chip_width}" height="{height}" rx="{height // 2}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>'
        f'<text x="{x + 14}" y="{y + height - 10}" fill="{text_fill}" font-family="{FONT_BODY}" font-size="{size}" font-weight="700">{escape(text)}</text></g>'
    )


def panel(x: int, y: int, w: int, h: int, label: str, title: str, subtitle: str | None = None) -> str:
    parts = [
        f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="28" fill="{SURFACE}" stroke="{BORDER}" stroke-width="2" filter="url(#panelShadow)"/>',
        f'<rect x="{x}" y="{y}" width="{w}" height="54" rx="28" fill="{SLATE_FILL}" stroke="none"/>',
        f'<text x="{x + 22}" y="{y + 24}" fill="{SOFT}" font-family="{FONT_BODY}" font-size="12" font-weight="700" letter-spacing="1.5">{escape(label.upper())}</text>',
        f'<text x="{x + 22}" y="{y + 42}" fill="{INK}" font-family="{FONT_TITLE}" font-size="24" font-weight="700">{escape(title)}</text>',
    ]
    if subtitle:
        parts.append(f'<text x="{x + 22}" y="{y + 72}" fill="{MUTED}" font-family="{FONT_BODY}" font-size="14">{escape(subtitle)}</text>')
    parts.append("</g>")
    return "".join(parts)


def section_card(x: int, y: int, w: int, h: int, title: str, accent: str, fill: str, lines: list[str]) -> str:
    body_lines: list[str] = []
    for line in lines:
        body_lines.extend(wrap_line(line, max(18, int(w / 10))))
    return (
        f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" stroke="{accent}" stroke-width="1.6" filter="url(#cardShadow)"/>'
        f'<rect x="{x}" y="{y}" width="8" height="{h}" rx="8" fill="{accent}"/>'
        f'{svg_text(x + 20, y + 30, wrap_line(title, max(16, int(w / 11))), 17, INK, FONT_TITLE, 700)}'
        f'{svg_text(x + 20, y + 62, body_lines, 13, MUTED)}'
        "</g>"
    )


def mini_card(x: int, y: int, w: int, h: int, title: str, note: str, accent: str, fill: str) -> str:
    return (
        f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{fill}" stroke="{accent}" stroke-width="1.4"/>'
        f'<text x="{x + 18}" y="{y + 28}" fill="{INK}" font-family="{FONT_TITLE}" font-size="17" font-weight="700">{escape(title)}</text>'
        f'{svg_text(x + 18, y + 52, wrap_line(note, max(15, int(w / 11))), 13, MUTED)}'
        "</g>"
    )


def compact_box(x: int, y: int, w: int, h: int, title: str, accent: str, fill: str, title_size: int = 15) -> str:
    return (
        f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{fill}" stroke="{accent}" stroke-width="1.5"/>'
        f'{svg_text(x + 16, y + 24, wrap_line(title, max(12, int(w / 11))), title_size, INK, FONT_TITLE, 700, 18)}'
        "</g>"
    )


def stage_card(x: int, y: int, w: int, h: int, stage: Stage) -> str:
    if stage.kind == "agent":
        accent = BLUE
        fill = BLUE_FILL
        tag_fill = "#FFFFFF"
        tag_text = BLUE
    else:
        accent = SLATE
        fill = SURFACE
        tag_fill = SLATE_FILL
        tag_text = SLATE

    title_lines = wrap_line(stage.title, 16)
    return (
        f'<g id="stage-{stage.number}">'
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" stroke="{accent}" stroke-width="2" filter="url(#cardShadow)"/>'
        f'<circle cx="{x + 28}" cy="{y + 28}" r="18" fill="{accent}"/>'
        f'<text x="{x + 22}" y="{y + 34}" fill="#FFFFFF" font-family="{FONT_BODY}" font-size="15" font-weight="700">{stage.number}</text>'
        f'{svg_text(x + 20, y + 68, title_lines, 19, INK, FONT_TITLE, 700, 24)}'
        f'<rect x="{x + 20}" y="{y + h - 44}" width="84" height="28" rx="14" fill="{tag_fill}" stroke="{accent}" stroke-width="1.4"/>'
        f'<text x="{x + 36}" y="{y + h - 25}" fill="{tag_text}" font-family="{FONT_BODY}" font-size="12" font-weight="700">{escape(stage.kind.upper())}</text>'
        "</g>"
    )


def connector(points: list[tuple[int, int]], color: str = "#365E84", width: float = 2.4, dashed: bool = False) -> str:
    dash = ' stroke-dasharray="8 8"' if dashed else ""
    path = "M " + " L ".join(f"{x} {y}" for x, y in points)
    return f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"{dash} marker-end="url(#arrowHead)"/>'


def build_svg() -> str:
    svg_parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" fill="none">',
        """
<defs>
  <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#F9FBFE"/>
    <stop offset="100%" stop-color="#EEF3F9"/>
  </linearGradient>
  <pattern id="dotGrid" width="32" height="32" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1.2" fill="#DCE6F0" opacity="0.45"/>
  </pattern>
  <filter id="panelShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#17324D" flood-opacity="0.07"/>
  </filter>
  <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#17324D" flood-opacity="0.06"/>
  </filter>
  <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="8.4" refY="5" orient="auto">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#365E84"/>
  </marker>
</defs>
        """,
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="url(#bgGrad)"/>',
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="url(#dotGrid)" opacity="0.32"/>',
        f'<rect x="30" y="118" width="2140" height="1162" rx="38" fill="rgba(255,255,255,0.34)" stroke="{OUTER}" stroke-width="2" stroke-dasharray="10 10"/>',
        f'<text x="60" y="72" fill="{INK}" font-family="{FONT_TITLE}" font-size="36" font-weight="700">IRIS Enterprise Architecture</text>',
        f'<text x="60" y="102" fill="{MUTED}" font-family="{FONT_BODY}" font-size="17">Workflow-first platform view centered on cession processing, human control, and selective AI assistance</text>',
        chip(1325, 54, "React Frontend", BLUE_FILL, BLUE, BLUE, 160),
        chip(1498, 54, "FastAPI Orchestration", TEAL_FILL, TEAL, TEAL, 210),
        chip(1722, 54, "OpenAI Agents", VIOLET_FILL, VIOLET, VIOLET, 165),
        chip(1900, 54, "SQLAlchemy Data Core", GREEN_FILL, GREEN, GREEN, 210),
    ]

    svg_parts.append(panel(80, 210, 360, 210, "Section 1", "External Sources"))
    svg_parts.append(panel(470, 210, 760, 120, "Section 2", "Presentation Layer"))
    svg_parts.append(panel(1260, 210, 860, 120, "Section 4", "AI / Agentic Layer"))
    svg_parts.append(panel(470, 350, 1650, 98, "Section 3", "API & Orchestration Layer"))
    svg_parts.append(panel(100, 470, 2000, 330, "Section 5", "Core Workflow Pipeline", "Primary operational flow"))
    svg_parts.append(panel(120, 840, 700, 220, "Section 6", "Data & Storage"))
    svg_parts.append(panel(850, 840, 700, 220, "Section 7", "Governance / Compliance"))
    svg_parts.append(panel(1580, 840, 520, 220, "Section 8", "Runtime / Infrastructure"))

    svg_parts.extend(
        [
            compact_box(104, 286, 148, 60, "Cedant Files", BLUE, BLUE_FILL),
            compact_box(268, 286, 148, 60, "Internal Operations", TEAL, TEAL_FILL, 14),
            compact_box(104, 360, 148, 60, "Compliance Teams", GOLD, GOLD_FILL, 14),
            compact_box(268, 360, 148, 60, "Downstream Consumers", GREEN, GREEN_FILL, 14),
        ]
    )

    presentation_y = 260
    presentation_x = [500, 670, 840, 1010]
    presentation_items = [
        ("React Frontend", BLUE_FILL, BLUE),
        ("Dashboards", TEAL_FILL, TEAL),
        ("Worklists", BLUE_FILL, BLUE),
        ("Human Review", ROSE_FILL, ROSE),
    ]
    for x, (label, fill, stroke) in zip(presentation_x, presentation_items):
        svg_parts.append(chip(x, presentation_y, label, fill, stroke, stroke, 140, 34, 13))

    ai_y = 260
    ai_x = [1290, 1460, 1640, 1835]
    ai_items = [
        ("OpenAI", VIOLET_FILL, VIOLET, 130),
        ("Workflow Agents", BLUE_FILL, BLUE, 150),
        ("Reasoning & Verification", GOLD_FILL, GOLD, 190),
        ("IRiS Assist", TEAL_FILL, TEAL, 125),
    ]
    for x, (label, fill, stroke, width) in zip(ai_x, ai_items):
        svg_parts.append(chip(x, ai_y, label, fill, stroke, stroke, width, 34, 13))

    orchestration_y = 386
    orchestration_x = [500, 760, 1080, 1410, 1725]
    orchestration_items = [
        ("FastAPI APIs", NAVY := "#24496E", NAVY_FILL := "#EDF4FA", 190),
        ("Claims Orchestration", TEAL, TEAL_FILL, 260),
        ("Workflow Coordination", BLUE, BLUE_FILL, 280),
        ("Execution Control", VIOLET, VIOLET_FILL, 220),
        ("Admin Agent Controls", ROSE, ROSE_FILL, 250),
    ]
    for x, (label, stroke, fill, width) in zip(orchestration_x, orchestration_items):
        svg_parts.append(chip(x, orchestration_y, label, fill, stroke, stroke, width, 36, 14))

    svg_parts.append(chip(1768, 514, "AGENT", BLUE_FILL, BLUE, BLUE, 98, 30, 12))
    svg_parts.append(chip(1878, 514, "SYSTEM", SLATE_FILL, SLATE, SLATE, 106, 30, 12))

    stage_x_start = 130
    stage_y = 575
    stage_w = 160
    stage_h = 168
    stage_gap = 18
    stage_positions: list[tuple[int, int, int, int]] = []

    for index, stage in enumerate(STAGES):
        x = stage_x_start + index * (stage_w + stage_gap)
        stage_positions.append((x, stage_y, stage_w, stage_h))
        svg_parts.append(stage_card(x, stage_y, stage_w, stage_h, stage))

    for index in range(len(stage_positions) - 1):
        x, y, w, h = stage_positions[index]
        next_x, next_y, _, next_h = stage_positions[index + 1]
        svg_parts.append(connector([(x + w, y + h // 2), (next_x, next_y + next_h // 2)]))

    svg_parts.extend(
        [
            connector([(440, 522), (480, 522), (480, 650), (130, 650)]),
            connector([(850, 330), (850, 456), (1050, 456), (1050, 540)]),
            connector([(1290, 430), (1720, 430), (1720, 540)], dashed=True),
        ]
    )

    svg_parts.append(
        f'<text x="1420" y="455" fill="{SOFT}" font-family="{FONT_BODY}" font-size="12" font-weight="700">POWERS AGENT STEPS</text>'
    )

    data_cards = [
        (145, 900, 150, 110, "Relational DB", "SQLAlchemy core | SQLite default"),
        (312, 900, 150, 110, "Workflow State", "JSON runtime overlays"),
        (479, 900, 150, 110, "File Artifacts", "Generated downstream files"),
        (646, 900, 150, 110, "Audit Storage", "Events, cases, and history"),
    ]
    for x, y, w, h, title, note in data_cards:
        svg_parts.append(mini_card(x, y, w, h, title, note, GREEN, GREEN_FILL))

    governance_cards = [
        (875, 900, 145, 110, "RBAC", "Role-aware access and approvals"),
        (1035, 900, 145, 110, "HITL", "Manual review and sign-off"),
        (1195, 900, 145, 110, "Sanctions", "Compliance case governance"),
        (1355, 900, 170, 110, "SLA / Worklist", "Operational routing and monitoring"),
    ]
    for x, y, w, h, title, note in governance_cards:
        svg_parts.append(mini_card(x, y, w, h, title, note, ROSE, ROSE_FILL))

    runtime_cards = [
        (1605, 900, 145, 110, "App Runtime", "SPA + FastAPI execution"),
        (1765, 900, 145, 110, "BackgroundTasks", "In-process async work"),
        (1925, 900, 150, 110, "Polling UI", "Status refresh and control"),
    ]
    for x, y, w, h, title, note in runtime_cards:
        svg_parts.append(mini_card(x, y, w, h, title, note, TEAL, TEAL_FILL))

    svg_parts.extend(
        [
            connector([(1028, 743), (1028, 840)]),
            connector([(1496, 743), (1496, 840)]),
            connector([(1860, 743), (1860, 840)]),
        ]
    )

    svg_parts.append(
        f'<text x="60" y="1240" fill="{SOFT}" font-family="{FONT_BODY}" font-size="12">Diagram reflects the implemented repository state: workflow-first FastAPI application, selective OpenAI assistance, SQLAlchemy persistence, JSON workflow overlays, and human approval controls.</text>'
    )
    svg_parts.append("</svg>")
    return "".join(svg_parts)


def mx_vertex(cell_id: str, value: str, x: int, y: int, w: int, h: int, fill: str, stroke: str, font_size: int = 18, rounded: int = 1) -> str:
    style = (
        f"rounded={rounded};whiteSpace=wrap;html=1;shadow=0;fillColor={fill};strokeColor={stroke};strokeWidth=1.5;"
        f"fontColor={INK};fontSize={font_size};fontStyle=1;align=left;verticalAlign=top;spacingTop=10;spacingLeft=12;"
    )
    return (
        f'<mxCell id="{cell_id}" value="{value}" style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>'
        "</mxCell>"
    )


def mx_edge(edge_id: str, source: str, target: str, dashed: bool = False) -> str:
    dashed_style = "dashed=1;dashPattern=8 8;" if dashed else ""
    style = (
        "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
        "strokeColor=#365E84;strokeWidth=2;endArrow=block;endFill=1;"
        f"{dashed_style}"
    )
    return (
        f'<mxCell id="{edge_id}" style="{style}" edge="1" parent="1" source="{source}" target="{target}">'
        '<mxGeometry relative="1" as="geometry"/>'
        "</mxCell>"
    )


def drawio_value(title: str, note: str | None = None) -> str:
    if not note:
        return f"<b>{escape(title)}</b>"
    return f"<b>{escape(title)}</b><br/><font style=&quot;font-size:12px;color:{MUTED};&quot;>{escape(note)}</font>"


def build_drawio() -> str:
    cells = [
        '<mxCell id="0"/>',
        '<mxCell id="1" parent="0"/>',
        mx_vertex("presentation", drawio_value("Presentation Layer", "React frontend | dashboards | worklists | human review"), 470, 210, 760, 120, SURFACE, BORDER, 22),
        mx_vertex("ai", drawio_value("AI / Agentic Layer", "OpenAI | workflow agents | reasoning | IRiS Assist"), 1260, 210, 860, 120, SURFACE, BORDER, 22),
        mx_vertex("api", drawio_value("API & Orchestration Layer", "FastAPI APIs | claims orchestration | workflow coordination | execution control"), 470, 350, 1650, 98, SURFACE, BORDER, 22),
        mx_vertex("external", drawio_value("External Sources", "Cedant files | internal operations | compliance teams | downstream consumers"), 80, 210, 360, 210, SURFACE, BORDER, 22),
        mx_vertex("workflow", drawio_value("Core Workflow Pipeline", "Primary operational flow"), 100, 470, 2000, 330, SURFACE, BORDER, 22),
        mx_vertex("data", drawio_value("Data & Storage", "Relational DB | JSON overlays | file artifacts | audit storage"), 120, 840, 700, 220, SURFACE, BORDER, 22),
        mx_vertex("governance", drawio_value("Governance / Compliance", "RBAC | HITL | sanctions governance | SLA / worklist"), 850, 840, 700, 220, SURFACE, BORDER, 22),
        mx_vertex("runtime", drawio_value("Runtime / Infrastructure", "App runtime | BackgroundTasks | polling UI"), 1580, 840, 520, 220, SURFACE, BORDER, 22),
    ]

    stage_x = 130
    stage_y = 575
    stage_w = 160
    stage_h = 168
    stage_gap = 18
    stage_ids: list[str] = []

    for index, stage in enumerate(STAGES):
        stage_id = f"stage-{stage.number}"
        stage_ids.append(stage_id)
        x = stage_x + index * (stage_w + stage_gap)
        fill = BLUE_FILL if stage.kind == "agent" else SURFACE
        stroke = BLUE if stage.kind == "agent" else SLATE
        cells.append(mx_vertex(stage_id, drawio_value(f"{stage.number}. {stage.title}", stage.kind.upper()), x, stage_y, stage_w, stage_h, fill, stroke, 16))

    edge_index = 1
    cells.append(mx_edge(f"edge{edge_index}", "external", "stage-1"))
    edge_index += 1
    cells.append(mx_edge(f"edge{edge_index}", "presentation", "workflow"))
    edge_index += 1
    cells.append(mx_edge(f"edge{edge_index}", "api", "workflow"))
    edge_index += 1
    cells.append(mx_edge(f"edge{edge_index}", "ai", "workflow", dashed=True))
    edge_index += 1

    for source, target in zip(stage_ids, stage_ids[1:]):
        cells.append(mx_edge(f"edge{edge_index}", source, target))
        edge_index += 1

    cells.append(mx_edge(f"edge{edge_index}", "workflow", "data"))
    edge_index += 1
    cells.append(mx_edge(f"edge{edge_index}", "workflow", "governance"))
    edge_index += 1
    cells.append(mx_edge(f"edge{edge_index}", "workflow", "runtime"))

    root = "".join(cells)
    return (
        '<mxfile host="app.diagrams.net" modified="2026-05-20T00:00:00Z" agent="Codex" version="24.7.17" type="device">'
        '<diagram id="iris-enterprise-architecture" name="IRIS Enterprise Architecture">'
        f'<mxGraphModel dx="1800" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{WIDTH}" pageHeight="{HEIGHT}" math="0" shadow="0"><root>{root}</root></mxGraphModel>'
        "</diagram></mxfile>"
    )


def build_summary() -> str:
    return """# IRIS enterprise architecture summary

## Architecture at a glance
IRIS is a workflow-first longevity swap platform built as a React frontend over a FastAPI orchestration core. The architecture centers on cession processing, with selective OpenAI-assisted agent steps, human review controls, and a mixed persistence model spanning relational data, JSON workflow state, and generated file artifacts.

## Workflow explanation
The platform is designed around one primary operational flow:

1. File Upload
2. Detection & Mapping
3. Anomaly Detection
4. Resolution Generation
5. Clauses Retrieval
6. Process Settlement
7. Summary Generation
8. Sanction Screening
9. Downstream File Generation
10. Worklist Generation
11. Audit Trail Generation

This pipeline is the main execution path for cession handling and the dominant business workflow in the current repository.

## AI agent responsibilities
- Detection & Mapping Agent: identifies file type, cedant, contract, and processing context.
- Anomaly Detection Agent: surfaces data issues and exception candidates.
- Resolution Generation Agent: proposes and applies high-confidence corrections or review paths.
- Sanction Screening Agent: supports retained watchlist verification and escalation decisions.
- Downstream File Generation Agent: prepares release-ready downstream output files.
- OpenAI is used selectively for bounded reasoning and verification rather than as a free-form autonomous platform.

## System responsibilities
- Clauses Retrieval System: pulls deterministic contract clause controls for the workflow.
- Settlement Processing System: executes the financial processing path and settlement logic.
- Summary Generation System: compiles workflow outcomes and business-facing results.
- Worklist Generation System: routes tasks into the operational review queue.
- Audit Trail Generation System: records traceability and completion history.
- FastAPI orchestration coordinates the full pipeline and exposes the platform APIs.

## Governance and compliance
- RBAC and approval controls gate access and sensitive actions.
- Human-in-the-loop review is embedded in worklist, sanctions, and settlement outcomes.
- Sanctions compliance is a first-class checkpoint in the workflow.
- SLA and worklist routing keep operational review visible.
- Auditability is preserved across workflow outcomes, cases, and reports.

## Presentation talking points
- The architecture is intentionally centered on the cession workflow because that is the platform's operational core.
- AI is used only where it improves classification, anomaly review, resolution support, and sanctions verification.
- Deterministic systems remain responsible for clauses, settlement execution, workflow routing, and audit generation.
- Human review stays embedded at the business control points instead of being bolted on afterward.
- Data persistence is practical and layered: relational registers, workflow state overlays, and generated artifacts.
- The runtime is lightweight today: FastAPI execution, BackgroundTasks, and frontend polling rather than external queue infrastructure.

## Delivery notes
- The diagram is intentionally simplified for stakeholder presentation use.
- It reflects the implemented repository state and avoids adding infrastructure that is not present in the codebase.
"""


def main() -> None:
    SVG_PATH.write_text(build_svg(), encoding="utf-8")
    DRAWIO_PATH.write_text(build_drawio(), encoding="utf-8")
    SUMMARY_PATH.write_text(build_summary(), encoding="utf-8")


if __name__ == "__main__":
    main()
