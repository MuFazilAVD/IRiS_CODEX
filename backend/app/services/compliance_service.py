from __future__ import annotations

import csv
import io
import json
import logging
import unicodedata
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.errors import IrisAPIError
from app.repositories.compliance_repository import ComplianceRepository
from app.repositories.underwriting_repository import UnderwritingRepository
from app.services.underwriting_service import UnderwritingService


logger = logging.getLogger(__name__)

COMPLIANCE_OVERRIDES_FILE = Path(__file__).resolve().parent.parent / "mock_data" / "compliance_overrides.json"

ACTIVE_HITS = [
    {
        "screening_ref": "SHM-887",
        "hit_id": "SHM-887",
        "entity": "Sergei V. Markov",
        "cedent_id": "CED-1042",
        "cedent_name": "Northstar Pension Trust",
        "member_id": "PEN-0100234",
        "match_type": "OFAC SDN",
        "source": "OFAC DB (US Treasury)",
        "confidence": 0.88,
        "matched_on": "2025-04-29 09:14",
        "status": "Escalated",
        "reasoning": "Name, DOB and country match exceeds threshold 0.85. Recommend human review before proceeding.",
    },
    {
        "screening_ref": "SHM-903",
        "hit_id": "SHM-903",
        "entity": "John A. Whitcomb",
        "cedent_id": "CED-1042",
        "cedent_name": "Northstar Pension Trust",
        "member_id": "PEN-0104012",
        "match_type": "FinCEN 314(a)",
        "source": "FinCEN Watchlist",
        "confidence": 0.71,
        "matched_on": "2025-04-29 10:02",
        "status": "Pending Review",
        "reasoning": "Name and postcode overlap with a known record, but the date-of-birth confidence is below the escalation threshold.",
    },
    {
        "screening_ref": "SHM-944",
        "hit_id": "SHM-944",
        "entity": "Atlas Corporate Pensions",
        "cedent_id": "CED-1133",
        "cedent_name": "Atlas Corporate Pensions",
        "member_id": None,
        "match_type": "OFAC SDN",
        "source": "OFAC DB (US Treasury)",
        "confidence": 0.42,
        "matched_on": "2025-04-29 10:31",
        "status": "Under Review",
        "reasoning": "Fuzzy entity-name overlap detected with insufficient country resolution. Awaiting analyst review.",
    },
]

AUDIT_RISK_HEATMAP = [
    {"area": "Underwriting", "low": 2, "medium": 1, "high": 0},
    {"area": "Cession", "low": 4, "medium": 2, "high": 1},
    {"area": "Settlement", "low": 1, "medium": 2, "high": 1},
    {"area": "Compliance", "low": 3, "medium": 0, "high": 0},
    {"area": "Admin", "low": 1, "medium": 1, "high": 0},
]

WATCHLIST_CACHE = [
    {"entity_name": "Hans Muller", "list_name": "OFAC SDN", "source": "OFAC DB", "dob": "1962-03-15"},
    {"entity_name": "Petra Schmidt", "list_name": "FinCEN 314(a)", "source": "FinCEN", "dob": None},
    {"entity_name": "Sergei V. Markov", "list_name": "OFAC SDN", "source": "OFAC DB", "dob": None},
    {"entity_name": "Atlas Corporate Pensions", "list_name": "OFAC SDN", "source": "OFAC DB", "dob": None},
]


class ComplianceService:
    def __init__(self, repository: ComplianceRepository) -> None:
        self.repository = repository
        self.underwriting_service = UnderwritingService(UnderwritingRepository(repository.db))

    def get_sanctions_overview(self) -> dict[str, Any]:
        logger.info("Loading sanctions screening overview")
        kpi_payload = self.repository.get_dashboard_kpis().get("compliance", {})
        graph_payload = self.repository.get_dashboard_graphs().get("compliance", [])
        active_hits = self._active_hits()
        return {
            "title": "Sanctions Screening",
            "subtitle": "Watchlist oversight, manual reviews, bulk screening and compliance controls",
            "insight": kpi_payload.get("insight", ""),
            "quick_actions": kpi_payload.get("quick_actions", []),
            "kpis": self._serialize_compliance_kpis(kpi_payload.get("kpis", [])),
            "charts": graph_payload,
            "audit_risk_heatmap": deepcopy(AUDIT_RISK_HEATMAP),
            "active_hits": active_hits,
        }

    def list_active_hits(self) -> dict[str, Any]:
        logger.info("Loading active sanctions screening hits")
        items = self._active_hits()
        return {"total": len(items), "items": items}

    def screen_entity(
        self,
        entity_name: str,
        dob: str | None,
        cedent_id: str | None,
        member_id: str | None,
        trigger_type: str | None,
        cession_file_id: str | None,
    ) -> dict[str, Any]:
        logger.info("Running single-entity sanctions screening")
        logger.debug(
            "Sanctions screen entity_name=%s dob=%s cedent_id=%s member_id=%s trigger_type=%s cession_file_id=%s",
            entity_name,
            dob,
            cedent_id,
            member_id,
            trigger_type,
            cession_file_id,
        )
        normalized_name = self._normalize_name(entity_name)
        matches = [entry for entry in WATCHLIST_CACHE if self._normalize_name(entry["entity_name"]) == normalized_name]
        screening_ref = self._screening_ref(entity_name, member_id)

        if not matches:
            return {
                "screening_ref": screening_ref,
                "entity_name": entity_name,
                "result": "cleared",
                "matched_lists": [],
                "llm_called": False,
                "llm_confidence": 1.0,
                "llm_reasoning": "No keyword or fuzzy watchlist match exceeded the screening threshold.",
                "method": "keyword_no_match",
            }

        llm_result = self._mock_llm_verification(entity_name, dob, matches)
        return {
            "screening_ref": screening_ref,
            "entity_name": entity_name,
            "result": "review" if llm_result["is_genuine_match"] else "cleared",
            "matched_lists": [entry["list_name"] for entry in matches],
            "llm_called": True,
            "llm_confidence": llm_result["confidence"],
            "llm_reasoning": llm_result["reasoning"],
            "method": "llm_confirmed" if llm_result["is_genuine_match"] else "llm_false_positive",
            "source": matches[0]["source"],
            "trigger_type": trigger_type or "pipeline",
            "cedent_id": cedent_id,
            "member_id": member_id,
            "cession_file_id": cession_file_id,
        }

    def get_cedent_screening(self, cedent_id: str) -> dict[str, Any]:
        logger.info("Loading sanctions screening detail for cedent")
        logger.debug("Sanctions detail cedent_id=%s", cedent_id)
        cedent_detail = self.underwriting_service.get_cedent_detail(cedent_id)
        screening = cedent_detail.get("sanction_screening")
        if screening is None:
            logger.error("Cedent screening detail missing for cedent_id=%s", cedent_id)
            raise IrisAPIError(404, "Invalid cedent ID", "Cedent screening detail not found")
        return {
            "cedent_id": cedent_id,
            "cedent_name": cedent_detail.get("legal_entity_name"),
            "screening_status": cedent_detail.get("screening_status"),
            "sanction_screening": screening,
        }

    def trigger_bulk_screening(self, sources: list[str], scope: str) -> dict[str, Any]:
        logger.info("Triggering bulk sanctions screening")
        logger.debug("Bulk screening sources=%s scope=%s", sources, scope)
        normalized_sources = sources or ["OFAC", "FinCEN"]
        if scope != "all_active":
            logger.error("Bulk screening rejected because scope=%s is unsupported", scope)
            raise IrisAPIError(400, "Invalid scope", "Only all_active scope is supported in the POC")

        screened_ids: list[str] = []
        for cedent in self.repository.list_active_cedents():
            self.underwriting_service.trigger_sanction_screening(cedent.cedent_id, normalized_sources)
            screened_ids.append(cedent.cedent_id)

        return {
            "screening_run_id": f"bulk-scr-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}",
            "scope": scope,
            "sources": normalized_sources,
            "cedents_screened": len(screened_ids),
            "cedent_ids": screened_ids,
            "status": "completed",
        }

    def queue_bulk_screening(self, sources: list[str], scope: str) -> dict[str, Any]:
        logger.info("Queueing bulk sanctions screening job")
        logger.debug("Bulk screening queue sources=%s scope=%s", sources, scope)
        normalized_sources = sources or ["OFAC SDN", "FinCEN 314(a)"]
        if scope != "all_active":
            logger.error("Bulk screening queue rejected because scope=%s is unsupported", scope)
            raise IrisAPIError(400, "Invalid scope", "Only all_active scope is supported in the POC")

        job_id = f"scr-job-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
        self._store_bulk_job(
            {
                "job_id": job_id,
                "status": "queued",
                "scope": scope,
                "sources": normalized_sources,
                "estimated_duration_seconds": 120,
                "queued_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            }
        )
        return {
            "job_id": job_id,
            "status": "queued",
            "estimated_duration_seconds": 120,
        }

    def resolve_hit(self, screening_ref: str, action: str, notes: str | None) -> dict[str, Any]:
        logger.info("Resolving sanctions screening hit")
        logger.debug("Sanctions hit resolve screening_ref=%s action=%s notes=%s", screening_ref, action, notes)
        if action not in {"clear", "escalate", "mark_false_positive"}:
            logger.error("Sanctions hit resolve rejected because action=%s is invalid", action)
            raise IrisAPIError(400, "Invalid action", "Action must be clear, escalate, or mark_false_positive")

        hit = self._get_hit_or_error(screening_ref)
        now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        status_map = {
            "clear": "Cleared",
            "escalate": "Escalated",
            "mark_false_positive": "False Positive",
        }
        updated_hit = {
            **hit,
            "status": status_map[action],
            "resolution_notes": notes,
            "resolved_at": now,
        }
        self._store_hit_override(screening_ref, updated_hit)
        return {
            "screening_ref": screening_ref,
            "status": updated_hit["status"],
            "action": action,
            "resolved_at": now,
            "notes": notes,
        }

    def export_screening_report(self) -> dict[str, Any]:
        logger.info("Exporting screening report payload")
        overview = self.get_sanctions_overview()
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["Hit ID", "Entity", "Cedent", "Match Type", "Confidence", "Status"])
        for item in overview["active_hits"]:
            writer.writerow(
                [
                    item["screening_ref"],
                    item["entity"],
                    item["cedent_name"],
                    item["match_type"],
                    item["confidence"],
                    item["status"],
                ]
            )
        return {
            "filename": "sanctions-screening-report.csv",
            "content_type": "text/csv;charset=utf-8;",
            "content": buffer.getvalue(),
        }

    def _active_hits(self) -> list[dict[str, Any]]:
        active_statuses = {"Escalated", "Pending Review", "Under Review", "Review"}
        return [item for item in self._all_hits() if item.get("status") in active_statuses]

    def _all_hits(self) -> list[dict[str, Any]]:
        overrides = self._read_override_store().get("hits", {})
        items: list[dict[str, Any]] = []
        for seed_hit in deepcopy(ACTIVE_HITS):
            merged = {**seed_hit, **deepcopy(overrides.get(seed_hit["screening_ref"], {}))}
            merged["screening_ref"] = merged.get("screening_ref") or merged.get("hit_id")
            merged["hit_id"] = merged.get("hit_id") or merged["screening_ref"]
            items.append(merged)
        return items

    def _get_hit_or_error(self, screening_ref: str) -> dict[str, Any]:
        hit = next((item for item in self._all_hits() if item["screening_ref"] == screening_ref), None)
        if hit is None:
            logger.error("Sanctions hit not found for screening_ref=%s", screening_ref)
            raise IrisAPIError(404, "Invalid screening ref", "Screening hit was not found")
        return hit

    def _read_override_store(self) -> dict[str, Any]:
        if not COMPLIANCE_OVERRIDES_FILE.exists():
            return {}
        with COMPLIANCE_OVERRIDES_FILE.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else {}

    def _write_override_store(self, payload: dict[str, Any]) -> None:
        COMPLIANCE_OVERRIDES_FILE.parent.mkdir(parents=True, exist_ok=True)
        with COMPLIANCE_OVERRIDES_FILE.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)

    def _store_hit_override(self, screening_ref: str, hit: dict[str, Any]) -> None:
        store = self._read_override_store()
        hits = deepcopy(store.get("hits", {}))
        hits[screening_ref] = hit
        store["hits"] = hits
        self._write_override_store(store)

    def _store_bulk_job(self, job: dict[str, Any]) -> None:
        store = self._read_override_store()
        store["last_bulk_job"] = job
        self._write_override_store(store)

    def _serialize_compliance_kpis(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        mapping = {
            "Monthly Screening Pending": "monthly_screening_pending",
            "OFAC Matches": "ofac_matches",
            "FinCEN Matches": "fincen_matches",
            "False Positives Pending": "false_positives_pending",
            "Overrides Awaiting Approval": "overrides_awaiting_approval",
            "High Impact Changes": "high_impact_changes",
            "Audit Exceptions Open": "audit_exceptions_open",
            "Sensitive Export Alerts": "sensitive_export_alerts",
            "Access Violations": "access_violations",
            "Ref Data Changes": "ref_data_changes",
            "Compliance Holds Active": "compliance_holds_active",
            "Escalated Tasks": "escalated_tasks",
            "Contracts Under Review": "contracts_under_review",
            "Screening Coverage": "screening_coverage_pct",
        }
        payload: dict[str, Any] = {}
        for item in items:
            key = mapping.get(item.get("label", ""))
            if not key:
                continue
            numeric = self._coerce_kpi_value(item.get("value"))
            payload[key] = numeric
        return payload

    def _coerce_kpi_value(self, value: Any) -> Any:
        if isinstance(value, (int, float)):
            return value
        text = str(value or "").strip().replace(",", "")
        if text.endswith("%"):
            try:
                return float(text[:-1])
            except ValueError:
                return text
        try:
            return int(text)
        except ValueError:
            try:
                return float(text)
            except ValueError:
                return text

    def _normalize_name(self, value: str) -> str:
        ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
        return "".join(char.lower() for char in ascii_value if char.isalnum())

    def _screening_ref(self, entity_name: str, member_id: str | None) -> str:
        seed = f"{entity_name}:{member_id or ''}"
        digits = sum(ord(char) for char in seed) % 900
        return f"SHM-{digits + 100:03d}"

    def _mock_llm_verification(self, entity_name: str, dob: str | None, matches: list[dict[str, Any]]) -> dict[str, Any]:
        normalized_name = self._normalize_name(entity_name)
        if normalized_name == self._normalize_name("Hans Muller"):
            if dob == "1962-03-15":
                return {
                    "is_genuine_match": True,
                    "confidence": 0.92,
                    "reasoning": "Name, DOB and list source align above the conservative review threshold. Recommend human review.",
                }
            return {
                "is_genuine_match": True,
                "confidence": 0.86,
                "reasoning": "Name alignment is strong, but DOB is missing or incomplete. Conservative review is still recommended.",
            }

        if normalized_name == self._normalize_name("Petra Schmidt"):
            return {
                "is_genuine_match": False,
                "confidence": 0.88,
                "reasoning": "Keyword match was found, but the profile lacks supporting DOB or geography signals and is treated as a false positive.",
            }

        if normalized_name == self._normalize_name("Atlas Corporate Pensions"):
            return {
                "is_genuine_match": True,
                "confidence": 0.42,
                "reasoning": "Entity-name overlap remains unresolved. Confidence is low, but the case should stay under human review.",
            }

        return {
            "is_genuine_match": True,
            "confidence": 0.75,
            "reasoning": f"Potential watchlist overlap found against {[item['list_name'] for item in matches]}. Human review is recommended.",
        }
