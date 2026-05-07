from __future__ import annotations

import json
import logging
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.errors import IrisAPIError
from app.mock_data_loader import load_mock_data
from app.repositories.claims_repository import ClaimsRepository
from app.repositories.operations_repository import OperationsRepository
from app.services.claims_service import ClaimsService


logger = logging.getLogger(__name__)
UTC = timezone.utc

OPERATIONS_OVERRIDES_FILE = Path(__file__).resolve().parent.parent / "mock_data" / "operations_pipeline_overrides.json"

STEP_ORDER = [
    "normalization",
    "calculations",
    "variance_analysis",
    "screening",
    "ai_decision",
    "outcome",
]

STEP_LABELS = {
    "normalization": "Normalization",
    "calculations": "Calculations",
    "variance_analysis": "Variance Analysis",
    "screening": "Screening",
    "ai_decision": "AI Decision",
    "outcome": "Outcome",
}

STEP_SUBTITLES = {
    "normalization": "Ingestion & Normalization",
    "calculations": "Actuarial Engine",
    "variance_analysis": "Deviation Review",
    "screening": "Compliance & AML",
    "ai_decision": "Agent Recommendation",
    "outcome": "Workflow Finalization",
}

STEP_STATUS_FIELDS = {
    "normalization": "normalization_status",
    "calculations": "calculations_status",
    "variance_analysis": "variance_analysis_status",
    "screening": "screening_status",
    "ai_decision": "ai_decision_status",
    "outcome": "outcome_status",
}

NORMALIZATION_RULES = [
    {
        "title": "DOB -> Temporal Standard",
        "body": "Rule: [DD/MM/YYYY] -> ISO-8601 [YYYY-MM-DD]. Statistical imputation fallback for missing values using population median.",
    },
    {
        "title": "DOB -> Age Calculation",
        "body": "Rule: Calculate derived Age column from normalized DOB relative to valuation date (2026-04-27).",
    },
    {
        "title": "Monthly Pension -> Precision Mapping",
        "body": "Rule: Strip currency symbols and thousands separators. Cast '2,450.00' -> numeric 2450.00.",
    },
    {
        "title": "Spouse Flag -> Logical Boolean",
        "body": "Rule: Map Domain {'Y','Yes','1'} -> True; {'N','No','0'} -> False. Critical for survivor benefit logic.",
    },
    {
        "title": "First/Last Name -> Identity Unification",
        "body": "Rule: Concatenate First + Last -> Full Name. Proper capitalization (hans -> Hans).",
    },
    {
        "title": "Gender -> Enum Alignment",
        "body": "Rule: Standardize {'M','1'} -> 'M'; {'F','2'} -> 'F'. Infer from salutation if field is ambiguous.",
    },
    {
        "title": "RED ID -> Unique Reference",
        "body": "Rule: Direct identifier mapping. Verify checksum if present in cedant header.",
    },
]


class OperationsService:
    def __init__(self, repository: OperationsRepository) -> None:
        self.repository = repository

    def list_pipelines(self) -> dict[str, Any]:
        logger.info("Loading active operations pipelines")
        active_pipelines: list[dict[str, Any]] = []
        for pipeline in self._load_pipeline_rows():
            merged = self._merge_pipeline_state(pipeline)
            if merged.get("aborted"):
                continue
            active_pipelines.append(
                {
                    "process_id": merged["process_id"],
                    "filename": merged["filename"],
                    "cedent": merged["cedent"],
                    "cedent_id": merged.get("cedent_id"),
                    "received_at": merged["received_at"],
                    "priority": merged["priority"],
                    "current_step": STEP_LABELS[merged["current_step_id"]],
                    "current_step_id": merged["current_step_id"],
                    "pipeline_health": merged["pipeline_health"],
                    "period": merged.get("period"),
                }
            )
        active_pipelines.sort(key=lambda item: item["received_at"], reverse=True)
        return {"active_pipelines": active_pipelines}

    def get_pipeline(self, process_id: str) -> dict[str, Any]:
        logger.info("Loading operations pipeline shell")
        logger.debug("Operations pipeline process_id=%s", process_id)
        merged = self._merge_pipeline_state(self._get_pipeline_seed(process_id))
        return self._serialize_pipeline_state(merged)

    def get_normalization(self, process_id: str) -> dict[str, Any]:
        logger.info("Loading normalization step")
        logger.debug("Operations normalization process_id=%s", process_id)
        pipeline = self._merge_pipeline_state(self._get_pipeline_seed(process_id))
        payload = self._load_seed_payload("normalization_detail_seed.json", pipeline)
        payload["tabs"] = [
            "Input Preview",
            "Column Mapping",
            "Normalization Rules",
            "Validation & Data Quality",
            "Normalized Output",
        ]
        payload["normalization_rules"] = deepcopy(NORMALIZATION_RULES)
        payload["validation"]["filter_pills"] = ["All Fields", "Issues Only", "Modified Only"]
        payload["validation"]["actions"] = ["View Affected Records", "Override Imputation", "Flag for Review"]
        payload["normalized_output"] = self._build_normalized_output(payload["input_preview"]["rows"])
        payload["step"] = self._step_descriptor("normalization", pipeline)
        return payload

    def get_calculations(self, process_id: str) -> dict[str, Any]:
        logger.info("Loading calculations step")
        logger.debug("Operations calculations process_id=%s", process_id)
        pipeline = self._merge_pipeline_state(self._get_pipeline_seed(process_id))
        payload = self._load_seed_payload("calculations_detail_seed.json", pipeline)
        payload["title"] = "Calculations - Actuarial Engine"
        payload["subtitle"] = "Auto-run from normalized movement data against the linked contract configuration."
        payload["step"] = self._step_descriptor("calculations", pipeline)
        return payload

    def get_variance(self, process_id: str) -> dict[str, Any]:
        logger.info("Loading variance-analysis step")
        logger.debug("Operations variance process_id=%s", process_id)
        pipeline = self._merge_pipeline_state(self._get_pipeline_seed(process_id))
        payload = self._load_seed_payload("variance_analysis_seed.json", pipeline)
        payload["title"] = "Variance Analysis - Deviation Review"
        payload["subtitle"] = "Threshold controls, financial impact review and downstream routing."
        payload["step"] = self._step_descriptor("variance_analysis", pipeline)
        return payload

    def get_screening(self, process_id: str) -> dict[str, Any]:
        logger.info("Loading screening step")
        logger.debug("Operations screening process_id=%s", process_id)
        pipeline = self._merge_pipeline_state(self._get_pipeline_seed(process_id))
        payload = self._load_seed_payload("screening_detail_seed.json", pipeline)
        payload["title"] = "Screening - Compliance & AML"
        payload["subtitle"] = "Pipeline entities screened through keyword matching and LLM verification."
        payload["step"] = self._step_descriptor("screening", pipeline)
        payload["match_table"] = self._apply_screening_overrides(payload["match_table"], process_id)
        payload["entities"] = [
            {
                "screening_ref": self._screening_ref_for_entity(item["entity_name"]),
                "entity_name": item["entity_name"],
                "dob": item.get("dob"),
                "cedent_id": pipeline.get("cedent_id"),
                "member_id": item.get("member_id"),
                "trigger_type": "pipeline",
                "cession_file_id": process_id,
            }
            for item in payload["match_table"]
        ]
        payload["false_positives"] = sum(1 for item in payload["match_table"] if item["status"].lower() == "cleared")
        payload["critical_alerts"] = sum(1 for item in payload["match_table"] if item["status"].lower() in {"review", "escalated"})
        return payload

    def get_ai_decision(self, process_id: str) -> dict[str, Any]:
        logger.info("Loading AI decision step")
        logger.debug("Operations ai-decision process_id=%s", process_id)
        pipeline = self._merge_pipeline_state(self._get_pipeline_seed(process_id))
        payload = self._load_seed_payload("ai_decision_seed.json", pipeline)
        payload["title"] = "AI Decision - Agent Recommendation"
        payload["subtitle"] = "IRiS recommendation based on quality, variance, screening, and workflow controls."
        payload["step"] = self._step_descriptor("ai_decision", pipeline)
        return payload

    def get_outcome(self, process_id: str) -> dict[str, Any]:
        logger.info("Loading outcome step")
        logger.debug("Operations outcome process_id=%s", process_id)
        pipeline = self._merge_pipeline_state(self._get_pipeline_seed(process_id))
        payload = self._load_seed_payload("outcome_seed.json", pipeline)
        override_store = self._get_override(process_id)
        outcome_override = override_store.get("outcome", {})
        if outcome_override:
            payload.update({key: value for key, value in outcome_override.items() if key in {"final_status", "approval_required", "sla_status"}})
            if "summary" in outcome_override:
                payload["summary"] = outcome_override["summary"]
        payload["title"] = "Outcome - Workflow Finalization"
        payload["subtitle"] = "Summary, settlement actioning and SLA close-out."
        payload["step"] = self._step_descriptor("outcome", pipeline)
        return payload

    def advance_pipeline(self, process_id: str, current_step: str, action: str, notes: str | None) -> dict[str, Any]:
        logger.info("Advancing operations pipeline")
        logger.debug(
            "Operations advance process_id=%s current_step=%s action=%s notes=%s",
            process_id,
            current_step,
            action,
            notes,
        )
        pipeline = self._merge_pipeline_state(self._get_pipeline_seed(process_id))
        if pipeline.get("aborted"):
            logger.error("Pipeline advance rejected because the process is aborted process_id=%s", process_id)
            raise IrisAPIError(400, "Pipeline aborted", "This pipeline has already been aborted")

        step_id = self._normalize_step_id(current_step)
        if step_id not in STEP_ORDER:
            logger.error("Pipeline advance rejected because step=%s is invalid", current_step)
            raise IrisAPIError(400, "Invalid step", f"{current_step} is not a valid pipeline step")

        statuses = deepcopy(pipeline["step_statuses"])
        now = self._to_iso(datetime.now(UTC))
        patch: dict[str, Any] = {
            "current_step_id": pipeline["current_step_id"],
            "step_statuses": statuses,
            "pipeline_health": pipeline["pipeline_health"],
            "last_action_at": now,
        }

        if step_id == "outcome":
            outcome_payload = self.get_outcome(process_id)
            settlement_row = self._build_outcome_settlement_row(process_id, pipeline, outcome_payload)
            claims_service = self._claims_service()
            claims_service.upsert_mock_settlement(settlement_row)
            if action == "approve_settlement":
                claims_service.approve_settlement(settlement_row["settlement_id"], notes or "Approved from pipeline outcome step")
            elif action == "hold_payment":
                claims_service.hold_settlement(settlement_row["settlement_id"], notes or "Held from pipeline outcome step")
            elif action == "reject_case":
                claims_service.dispute_settlement(settlement_row["settlement_id"], notes or "Rejected from pipeline outcome step")

            final_status_map = {
                "approve_settlement": ("Approved", False, "Complete"),
                "hold_payment": ("Held", True, "At Risk"),
                "reject_case": ("Rejected", True, "Critical"),
            }
            final_status, approval_required, sla_status = final_status_map.get(
                action,
                ("Pending Approval", True, "At Risk"),
            )
            patch["step_statuses"]["outcome"] = "complete" if action == "approve_settlement" else "in_progress"
            patch["current_step_id"] = "outcome"
            patch["outcome"] = {
                "final_status": final_status,
                "approval_required": approval_required,
                "sla_status": sla_status,
                "summary": {
                    "contract": outcome_payload["summary"]["contract"],
                    "total_records": outcome_payload["summary"]["total_records"],
                    "issues_resolved": True,
                    "compliance": (
                        "Cleared"
                        if action == "approve_settlement"
                        else ("Escalated for manual review" if action == "reject_case" else "Pending 1 review")
                    ),
                },
            }
        else:
            patch["step_statuses"][step_id] = "complete"
            next_step = self._next_step(step_id)
            if next_step:
                patch["step_statuses"][next_step] = "in_progress"
                patch["current_step_id"] = next_step
            else:
                patch["current_step_id"] = step_id

        patch["action_log"] = self._append_action_log(
            process_id,
            {
                "timestamp": now,
                "action": "advance",
                "step": step_id,
                "decision": action,
                "notes": notes or "",
            },
        )
        self._store_override(process_id, patch)
        return self.get_pipeline(process_id)

    def abort_pipeline(self, process_id: str, reason: str | None) -> dict[str, Any]:
        logger.info("Aborting operations pipeline")
        logger.debug("Operations abort process_id=%s reason=%s", process_id, reason)
        self._get_pipeline_seed(process_id)
        now = self._to_iso(datetime.now(UTC))
        patch = {
            "aborted": True,
            "pipeline_health": "Aborted",
            "last_action_at": now,
            "action_log": self._append_action_log(
                process_id,
                {
                    "timestamp": now,
                    "action": "abort",
                    "step": "outcome",
                    "decision": "abort_process",
                    "notes": reason or "",
                },
            ),
        }
        self._store_override(process_id, patch)
        return {
            "process_id": process_id,
            "status": "aborted",
            "reason": reason or "Aborted by claims operations",
            "aborted_at": now,
        }

    def resolve_screening_hit(self, process_id: str, screening_ref: str, action: str, notes: str | None) -> dict[str, Any]:
        logger.info("Resolving pipeline screening hit")
        logger.debug(
            "Operations screening resolve process_id=%s screening_ref=%s action=%s",
            process_id,
            screening_ref,
            action,
        )
        self._get_pipeline_seed(process_id)
        status_map = {
            "escalate_to_compliance": "Escalated",
            "mark_false_positive": "Cleared",
            "request_additional_data": "Review",
        }
        next_status = status_map.get(action)
        if next_status is None:
            logger.error("Screening resolution rejected because action=%s is unsupported", action)
            raise IrisAPIError(400, "Invalid screening action", f"{action} is not supported")

        override = self._get_override(process_id)
        screening_overrides = deepcopy(override.get("screening_overrides", {}))
        screening_overrides[screening_ref] = {"status": next_status, "notes": notes or ""}
        now = self._to_iso(datetime.now(UTC))
        self._store_override(
            process_id,
            {
                "screening_overrides": screening_overrides,
                "last_action_at": now,
                "action_log": self._append_action_log(
                    process_id,
                    {
                        "timestamp": now,
                        "action": "screening_resolve",
                        "step": "screening",
                        "decision": action,
                        "notes": notes or screening_ref,
                    },
                ),
            },
        )
        return self.get_screening(process_id)

    def _serialize_pipeline_state(self, pipeline: dict[str, Any]) -> dict[str, Any]:
        return {
            "process_id": pipeline["process_id"],
            "filename": pipeline["filename"],
            "cedent": pipeline["cedent"],
            "cedent_id": pipeline.get("cedent_id"),
            "received_at": pipeline["received_at"],
            "priority": pipeline["priority"],
            "period": pipeline.get("period"),
            "pipeline_health": pipeline["pipeline_health"],
            "current_step": STEP_LABELS[pipeline["current_step_id"]],
            "current_step_id": pipeline["current_step_id"],
            "total_records": pipeline.get("total_records"),
            "affected_records": pipeline.get("affected_records"),
            "aborted": pipeline.get("aborted", False),
            "steps": [self._step_descriptor(step_id, pipeline) for step_id in STEP_ORDER],
            "action_log": pipeline.get("action_log", []),
            "last_action_at": pipeline.get("last_action_at"),
        }

    def _step_descriptor(self, step_id: str, pipeline: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": step_id,
            "label": STEP_LABELS[step_id],
            "subtitle": STEP_SUBTITLES[step_id],
            "status": pipeline["step_statuses"][step_id],
        }

    def _merge_pipeline_state(self, pipeline: dict[str, Any]) -> dict[str, Any]:
        override = self._get_override(pipeline["process_id"])
        statuses = {
            step_id: str(pipeline.get(STEP_STATUS_FIELDS[step_id], "pending")).lower()
            for step_id in STEP_ORDER
        }
        statuses.update(override.get("step_statuses", {}))
        current_step_id = override.get("current_step_id") or self._current_step_from_statuses(statuses)
        merged = deepcopy(pipeline)
        merged["step_statuses"] = statuses
        merged["current_step_id"] = current_step_id
        merged["pipeline_health"] = override.get("pipeline_health", merged.get("pipeline_health", "Optimal"))
        merged["aborted"] = bool(override.get("aborted", False))
        merged["action_log"] = deepcopy(override.get("action_log", []))
        merged["last_action_at"] = override.get("last_action_at")
        return merged

    def _current_step_from_statuses(self, statuses: dict[str, str]) -> str:
        for step_id in STEP_ORDER:
            if statuses.get(step_id) == "in_progress":
                return step_id
        for step_id in STEP_ORDER:
            if statuses.get(step_id) == "pending":
                return step_id
        return "outcome"

    def _next_step(self, step_id: str) -> str | None:
        try:
            index = STEP_ORDER.index(step_id)
        except ValueError:
            return None
        if index >= len(STEP_ORDER) - 1:
            return None
        return STEP_ORDER[index + 1]

    def _normalize_step_id(self, value: str) -> str:
        text = value.strip().lower().replace("-", "_").replace(" ", "_")
        aliases = {
            "normalisation": "normalization",
            "variance": "variance_analysis",
            "variance_analysis": "variance_analysis",
            "ai_decisioning": "ai_decision",
            "ai_decision": "ai_decision",
        }
        return aliases.get(text, text)

    def _load_pipeline_rows(self) -> list[dict[str, Any]]:
        return deepcopy(load_mock_data("pipeline_seed.json"))

    def _get_pipeline_seed(self, process_id: str) -> dict[str, Any]:
        for item in self._load_pipeline_rows():
            if item["process_id"] == process_id:
                return item
        logger.error("Operations pipeline was not found process_id=%s", process_id)
        raise IrisAPIError(404, "Invalid process ID", "Pipeline process was not found")

    def _load_seed_payload(self, filename: str, pipeline: dict[str, Any]) -> dict[str, Any]:
        base_payload = deepcopy(load_mock_data(filename))
        if base_payload.get("process_id") == pipeline["process_id"]:
            return base_payload
        if "filename" in base_payload:
            base_payload["filename"] = pipeline["filename"]
        if "cedent" in base_payload:
            base_payload["cedent"] = pipeline["cedent"]
        if "process_id" in base_payload:
            base_payload["process_id"] = pipeline["process_id"]
        if "period" in base_payload and pipeline.get("period"):
            base_payload["period"] = pipeline["period"]
        if filename == "normalization_detail_seed.json":
            prefix = self._member_prefix(pipeline.get("cedent_id"))
            for index, row in enumerate(base_payload["input_preview"]["rows"], start=1):
                row["RED ID"] = f"{prefix}-{8800 + index}"
        if filename == "screening_detail_seed.json":
            base_payload["matches_found"] = 0
            base_payload["false_positives"] = 0
            base_payload["critical_alerts"] = 0
            base_payload["match_table"] = []
            base_payload["insight"] = "No entities require compliance review for this pipeline."
        if filename == "outcome_seed.json" and pipeline.get("period"):
            base_payload["summary"]["contract"] = f'{pipeline["cedent"]} {pipeline["period"]}'
        return base_payload

    def _build_normalized_output(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        normalized_rows: list[dict[str, Any]] = []
        valuation_date = date(2026, 4, 27)
        for row in rows[:6]:
            raw_dob = str(row.get("DOB") or "").strip()
            iso_dob = self._normalize_dob(raw_dob)
            age_value = self._age_from_iso_dob(iso_dob, valuation_date) if iso_dob else "Imputed"
            normalized_rows.append(
                {
                    "member_id": row.get("RED ID"),
                    "full_name": f'{row.get("First Name", "")} {row.get("Last Name", "")}'.strip(),
                    "dob": iso_dob or "Imputed",
                    "age": age_value,
                    "monthly_pension": self._numeric_currency(row.get("Monthly Pension")),
                    "gender": row.get("Gender"),
                    "spouse_flag": self._boolean_flag(row.get("Spouse Flag")),
                    "event_type": row.get("Event Type"),
                    "event_date": row.get("Event Date"),
                }
            )
        return {
            "columns": [
                "Member ID",
                "Full Name",
                "DOB",
                "Age",
                "Monthly Pension",
                "Gender",
                "Spouse Flag",
                "Event Type",
                "Event Date",
            ],
            "rows": normalized_rows,
        }

    def _normalize_dob(self, value: str) -> str | None:
        if not value:
            return None
        try:
            parsed = datetime.strptime(value, "%d/%m/%Y").date()
        except ValueError:
            return None
        return parsed.isoformat()

    def _age_from_iso_dob(self, value: str, valuation_date: date) -> int:
        parsed = date.fromisoformat(value)
        return valuation_date.year - parsed.year - ((valuation_date.month, valuation_date.day) < (parsed.month, parsed.day))

    def _numeric_currency(self, value: Any) -> float:
        text = str(value or "0").replace(",", "")
        return round(float(text), 2)

    def _boolean_flag(self, value: Any) -> str:
        text = str(value or "").strip().upper()
        return "True" if text in {"Y", "YES", "1", "TRUE"} else "False"

    def _apply_screening_overrides(self, items: list[dict[str, Any]], process_id: str) -> list[dict[str, Any]]:
        override = self._get_override(process_id)
        screening_overrides = override.get("screening_overrides", {})
        resolved_items: list[dict[str, Any]] = []
        for item in items:
            row = deepcopy(item)
            row["screening_ref"] = self._screening_ref_for_entity(row["entity_name"])
            row_override = screening_overrides.get(row["screening_ref"])
            if row_override:
                row["status"] = row_override["status"]
            resolved_items.append(row)
        return resolved_items

    def _screening_ref_for_entity(self, entity_name: str) -> str:
        digits = sum(ord(char) for char in entity_name if char.isalnum()) % 900
        return f"SHM-{digits + 100:03d}"

    def _member_prefix(self, cedent_id: str | None) -> str:
        seed = "".join(char for char in (cedent_id or "IRI") if char.isalpha()).upper()
        return (seed[:3] or "IRI").ljust(3, "I")

    def _append_action_log(self, process_id: str, event: dict[str, Any]) -> list[dict[str, Any]]:
        existing = deepcopy(self._get_override(process_id).get("action_log", []))
        existing.append(event)
        return existing

    def _read_override_store(self) -> dict[str, Any]:
        if not OPERATIONS_OVERRIDES_FILE.exists():
            return {}
        with OPERATIONS_OVERRIDES_FILE.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else {}

    def _write_override_store(self, store: dict[str, Any]) -> None:
        OPERATIONS_OVERRIDES_FILE.parent.mkdir(parents=True, exist_ok=True)
        with OPERATIONS_OVERRIDES_FILE.open("w", encoding="utf-8") as handle:
            json.dump(store, handle, indent=2)

    def _get_override(self, process_id: str) -> dict[str, Any]:
        return deepcopy(self._read_override_store().get(process_id, {}))

    def _store_override(self, process_id: str, patch: dict[str, Any]) -> None:
        store = self._read_override_store()
        current = deepcopy(store.get(process_id, {}))
        current.update(patch)
        store[process_id] = current
        self._write_override_store(store)

    def _to_iso(self, value: datetime) -> str:
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")

    def _claims_service(self) -> ClaimsService:
        return ClaimsService(ClaimsRepository(self.repository.db))

    def _build_outcome_settlement_row(
        self,
        process_id: str,
        pipeline: dict[str, Any],
        outcome_payload: dict[str, Any],
    ) -> dict[str, Any]:
        calculations = self.get_calculations(process_id)
        period_start, period_end = self._period_bounds_from_label(pipeline.get("period"))
        fixed_leg_amount = round(float(calculations["fixed_leg_amount"]), 2)
        floating_leg_amount = round(float(calculations["floating_leg_amount"]), 2)
        net_amount = round(floating_leg_amount - fixed_leg_amount, 2)
        return {
            "settlement_id": self._outcome_settlement_id(process_id, period_end),
            "contract_id": None,
            "contract_name": outcome_payload["summary"]["contract"],
            "contract_version": "v1.0",
            "cedent_id": pipeline.get("cedent_id"),
            "cedent_name": pipeline["cedent"],
            "period_label": pipeline.get("period") or "Current Period",
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "fixed_leg_amount": fixed_leg_amount,
            "floating_leg_amount": floating_leg_amount,
            "net_amount": net_amount,
            "currency": outcome_payload["settlement_currency"],
            "direction": "reinsurer_to_cedant" if net_amount >= 0 else "cedant_to_reinsurer",
            "payment_due_date": (period_end + timedelta(days=30)).isoformat(),
            "status": "pending_approval",
            "source": f"{process_id} - {pipeline['filename']}",
        }

    def _outcome_settlement_id(self, process_id: str, period_end: date) -> str:
        digits = "".join(char for char in process_id if char.isdigit())
        suffix = digits[-3:] if digits else "900"
        quarter = ((period_end.month - 1) // 3) + 1
        return f"SET-{period_end.year}-Q{quarter}-{suffix}"

    def _period_bounds_from_label(self, label: str | None) -> tuple[date, date]:
        if not label:
            return date(2026, 1, 1), date(2026, 3, 31)
        parts = label.split()
        if len(parts) != 2 or not parts[0].startswith("Q"):
            return date(2026, 1, 1), date(2026, 3, 31)
        quarter = int(parts[0][1:])
        year = int(parts[1])
        start_month = ((quarter - 1) * 3) + 1
        period_start = date(year, start_month, 1)
        period_end = {
            1: date(year, 3, 31),
            2: date(year, 6, 30),
            3: date(year, 9, 30),
            4: date(year, 12, 31),
        }.get(quarter, date(year, 3, 31))
        return period_start, period_end
