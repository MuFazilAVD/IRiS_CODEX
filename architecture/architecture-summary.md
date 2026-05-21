# IRIS enterprise architecture summary

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
