from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json
from typing import Any


ADMIN_STATE_PATH = Path(__file__).resolve().parent / "mock_data" / "admin_state.json"

VALID_HITL_BEHAVIORS = {"pause_for_approval", "pause_for_correction"}
VALID_FALLBACK_MODES = {"manual_review", "skip_step", "deterministic_rule"}

WORKFLOW_AGENT_DEFINITIONS: list[dict[str, Any]] = [
    {
        "key": "mapping",
        "step_id": "detect-map",
        "step_label": "Detect & Map",
        "agent_name": "Mapping Agent",
        "description": "Detect the cession file type, identify the cedent, and map the treaty context.",
        "default_threshold": 0.88,
        "default_retry_limit": 1,
        "default_escalation_rule": "Claims Ops review required before downstream automation continues.",
        "default_fallback_mode": "manual_review",
    },
    {
        "key": "anomaly_detection",
        "step_id": "validate",
        "step_label": "Anomalies",
        "agent_name": "Anomaly Detection Agent",
        "description": "Validate the uploaded rows and identify anomalies, warnings, and informational findings.",
        "default_threshold": 0.84,
        "default_retry_limit": 1,
        "default_escalation_rule": "Claims Ops anomaly review required when confidence is below threshold.",
        "default_fallback_mode": "manual_review",
    },
    {
        "key": "resolution",
        "step_id": "exceptions",
        "step_label": "Resolutions",
        "agent_name": "Resolution Agent",
        "description": "Apply high-confidence anomaly resolutions automatically and route the rest to HITL review.",
        "default_threshold": 0.9,
        "default_retry_limit": 0,
        "default_escalation_rule": "Claims Ops approval required for low-confidence or unsupported resolutions.",
        "default_fallback_mode": "manual_review",
    },
    {
        "key": "clause_validation",
        "step_id": "clauses",
        "step_label": "Clauses",
        "agent_name": "Clause Validation Agent",
        "description": "Verify the mapped file against contract clauses and rule controls.",
        "default_threshold": 0.86,
        "default_retry_limit": 1,
        "default_escalation_rule": "Clause review is required before execution when clause confidence is below threshold.",
        "default_fallback_mode": "manual_review",
    },
    {
        "key": "processing",
        "step_id": "process",
        "step_label": "Process",
        "agent_name": "Processing Agent",
        "description": "Execute the downstream cession processing logic and prepare settlement or population outcomes.",
        "default_threshold": 0.87,
        "default_retry_limit": 1,
        "default_escalation_rule": "Processing results require review when confidence falls below the configured floor.",
        "default_fallback_mode": "manual_review",
    },
    {
        "key": "results",
        "step_id": "summary",
        "step_label": "Summary",
        "agent_name": "Workflow Summary Agent",
        "description": "Compile the workflow summary, business impact, and completion narrative for the run.",
        "default_threshold": 0.8,
        "default_retry_limit": 0,
        "default_escalation_rule": "Summary review is required when derived completion insights fall below threshold.",
        "default_fallback_mode": "manual_review",
    },
    {
        "key": "sanction_screening",
        "step_id": "screening",
        "step_label": "Sanction Screening",
        "agent_name": "Sanction Screening Agent",
        "description": "Assess counterparties against sanctions sources and pause for HITL review when required.",
        "default_threshold": 0.92,
        "default_retry_limit": 0,
        "default_escalation_rule": "Escalate to compliance when sanctions screening remains below threshold.",
        "default_fallback_mode": "manual_review",
    },
    {
        "key": "file_generation",
        "step_id": "files",
        "step_label": "Files",
        "agent_name": "File Generation Agent",
        "description": "Generate downstream cession output files and package them for release.",
        "default_threshold": 0.85,
        "default_retry_limit": 1,
        "default_escalation_rule": "Claims Ops review is required when downstream file generation is incomplete.",
        "default_fallback_mode": "manual_review",
    },
    {
        "key": "worklist",
        "step_id": "worklist",
        "step_label": "Worklist",
        "agent_name": "Worklist Agent",
        "description": "Create and route all downstream worklist tasks created by the workflow.",
        "default_threshold": 0.82,
        "default_retry_limit": 1,
        "default_escalation_rule": "Operations review is required if workflow routing confidence is below threshold.",
        "default_fallback_mode": "manual_review",
    },
    {
        "key": "audit",
        "step_id": "audit",
        "step_label": "Audit",
        "agent_name": "Audit Agent",
        "description": "Finalize the workflow audit trail, approvals, overrides, retries, and completion traceability.",
        "default_threshold": 0.95,
        "default_retry_limit": 0,
        "default_escalation_rule": "Administrative review is required when audit completeness falls below threshold.",
        "default_fallback_mode": "manual_review",
    },
]


def default_workflow_agent_configs() -> list[dict[str, Any]]:
    return [
        {
            "key": definition["key"],
            "step_id": definition["step_id"],
            "step_label": definition["step_label"],
            "agent_name": definition["agent_name"],
            "description": definition["description"],
            "enabled": True,
            "confidence_threshold": float(definition["default_threshold"]),
            "hitl_behavior": "pause_for_approval",
            "escalation_rule": definition["default_escalation_rule"],
            "retry_limit": int(definition["default_retry_limit"]),
            "fallback_mode": definition["default_fallback_mode"],
        }
        for definition in WORKFLOW_AGENT_DEFINITIONS
    ]


def merge_workflow_agent_configs(raw_items: Any) -> list[dict[str, Any]]:
    defaults = {item["key"]: item for item in default_workflow_agent_configs()}
    merged: dict[str, dict[str, Any]] = {key: deepcopy(value) for key, value in defaults.items()}

    if isinstance(raw_items, list):
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            key = str(item.get("key") or "").strip()
            if key not in merged:
                continue
            candidate = merged[key]
            candidate["enabled"] = bool(item.get("enabled", candidate["enabled"]))
            candidate["confidence_threshold"] = clamp_threshold(item.get("confidence_threshold", candidate["confidence_threshold"]))
            hitl_behavior = str(item.get("hitl_behavior") or candidate["hitl_behavior"]).strip()
            candidate["hitl_behavior"] = hitl_behavior if hitl_behavior in VALID_HITL_BEHAVIORS else candidate["hitl_behavior"]
            escalation_rule = str(item.get("escalation_rule") or "").strip()
            if escalation_rule:
                candidate["escalation_rule"] = escalation_rule
            retry_limit = item.get("retry_limit", candidate["retry_limit"])
            try:
                candidate["retry_limit"] = max(0, int(retry_limit))
            except (TypeError, ValueError):
                pass
            fallback_mode = str(item.get("fallback_mode") or candidate["fallback_mode"]).strip()
            candidate["fallback_mode"] = fallback_mode if fallback_mode in VALID_FALLBACK_MODES else candidate["fallback_mode"]

    ordered: list[dict[str, Any]] = []
    for definition in WORKFLOW_AGENT_DEFINITIONS:
        ordered.append(deepcopy(merged[definition["key"]]))
    return ordered


def workflow_agent_config_map(raw_items: Any) -> dict[str, dict[str, Any]]:
    return {item["key"]: item for item in merge_workflow_agent_configs(raw_items)}


def load_workflow_agent_configs_from_admin_state() -> list[dict[str, Any]]:
    if ADMIN_STATE_PATH.exists():
        with ADMIN_STATE_PATH.open("r", encoding="utf-8") as handle:
            state = json.load(handle)
        if isinstance(state, dict):
            return merge_workflow_agent_configs(state.get("workflow_agents"))
    return default_workflow_agent_configs()


def clamp_threshold(value: Any) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.9
    return max(0.0, min(1.0, round(numeric, 4)))
