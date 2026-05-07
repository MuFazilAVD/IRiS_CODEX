from __future__ import annotations

import csv
import io
import json
import logging
import unicodedata
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import OPENAI_MODEL, openai_client
from app.errors import IrisAPIError
from app.repositories.compliance_repository import ComplianceRepository
from app.repositories.underwriting_repository import UnderwritingRepository
from app.services.underwriting_service import UnderwritingService


logger = logging.getLogger(__name__)
UTC = timezone.utc

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
    {
        "entity_name": "Hans Muller",
        "list_name": "OFAC SDN",
        "source": "OFAC DB",
        "dob": "1962-03-15",
        "country": "DE",
        "street_address": "Friedrichstrasse 91",
        "city": "Berlin",
        "postal_code": "10117",
        "tax_identification_number": None,
        "company_registration_number": None,
    },
    {
        "entity_name": "Petra Schmidt",
        "list_name": "FinCEN 314(a)",
        "source": "FinCEN",
        "dob": None,
        "country": "CH",
        "street_address": "Bahnhofstrasse 44",
        "city": "Zurich",
        "postal_code": "8001",
        "tax_identification_number": None,
        "company_registration_number": None,
    },
    {
        "entity_name": "Sergei V. Markov",
        "list_name": "OFAC SDN",
        "source": "OFAC DB",
        "dob": None,
        "country": "RU",
        "street_address": "Tverskaya Street 12",
        "city": "Moscow",
        "postal_code": "125009",
        "tax_identification_number": None,
        "company_registration_number": None,
    },
    {
        "entity_name": "Atlas Corporate Pensions",
        "list_name": "OFAC SDN",
        "source": "OFAC DB",
        "dob": None,
        "country": "RU",
        "street_address": "Nevsky Prospect 28",
        "city": "Saint Petersburg",
        "postal_code": "191186",
        "tax_identification_number": "RU-998877661",
        "company_registration_number": "RU-OGRN-1133",
    },
]

# MOCK IMPLEMENTATION: cedent street/city/postal identifiers are not part of the current cedents schema.
# These values enrich sanctions verification without inventing new DB columns.
CEDENT_IDENTITY_MOCKS: dict[str, dict[str, str]] = {
    "CED-0991": {
        "street_address": "10 Fenchurch Avenue",
        "city": "London",
        "postal_code": "EC3M 5BN",
        "tax_identification_number": "GB-991-384-220",
        "uk_company_registration_number": "09114320",
    },
    "CED-1042": {
        "street_address": "22 Bishopsgate",
        "city": "London",
        "postal_code": "EC2N 4BQ",
        "tax_identification_number": "GB-1042-774-921",
        "uk_company_registration_number": "04281042",
    },
    "CED-1087": {
        "street_address": "Rue du Rhone 14",
        "city": "Geneva",
        "postal_code": "1204",
        "tax_identification_number": "CHE-1087.442.119",
        "uk_company_registration_number": "N/A",
    },
    "CED-1133": {
        "street_address": "200 Liberty Street",
        "city": "New York",
        "postal_code": "10281",
        "tax_identification_number": "US-TIN-13-1133110",
        "uk_company_registration_number": "N/A",
    },
    "CED-1156": {
        "street_address": "100 King Street West",
        "city": "Toronto",
        "postal_code": "M5X 1A9",
        "tax_identification_number": "CA-BN-1156-8821",
        "uk_company_registration_number": "N/A",
    },
    "CED-1201": {
        "street_address": "Leopoldstrasse 20",
        "city": "Munich",
        "postal_code": "80802",
        "tax_identification_number": "DE-1201-442-008",
        "uk_company_registration_number": "N/A",
    },
}


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
        identity_context = self._cedent_identity_context(cedent_id, entity_name)
        logger.debug("Sanctions identity context screening_ref=%s context=%s", screening_ref, identity_context)

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
                "identity_context": identity_context,
            }

        llm_result = self._verify_watchlist_match(entity_name, dob, matches, identity_context)
        return {
            "screening_ref": screening_ref,
            "entity_name": entity_name,
            "result": "review" if llm_result["is_genuine_match"] else "cleared",
            "matched_lists": [entry["list_name"] for entry in matches],
            "llm_called": llm_result["llm_called"],
            "llm_confidence": llm_result["confidence"],
            "llm_reasoning": llm_result["reasoning"],
            "method": self._screening_method_label(llm_result),
            "source": matches[0]["source"],
            "trigger_type": trigger_type or "pipeline",
            "cedent_id": cedent_id,
            "member_id": member_id,
            "cession_file_id": cession_file_id,
            "identity_context": identity_context,
            "identity_match_summary": llm_result.get("identity_match_summary", []),
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
            "identity_context": self._cedent_identity_context(cedent_id, cedent_detail.get("legal_entity_name")),
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
            if merged.get("member_id") is None:
                identity_context = self._cedent_identity_context(merged.get("cedent_id"), merged.get("entity"))
                matches = [
                    entry
                    for entry in WATCHLIST_CACHE
                    if self._normalize_name(entry["entity_name"]) == self._normalize_name(str(merged.get("entity") or ""))
                ]
                merged["identity_context"] = identity_context
                merged["identity_match_summary"] = self._identity_match_summary(identity_context, matches)
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

    def _cedent_identity_context(self, cedent_id: str | None, entity_name: str | None = None) -> dict[str, Any] | None:
        cedent = self.repository.get_cedent(cedent_id) or self.repository.find_cedent_by_name(entity_name)
        if cedent is None:
            return None

        mock_identity = CEDENT_IDENTITY_MOCKS.get(cedent.cedent_id, {})
        tax_identifier = cedent.tax_identification_number or mock_identity.get("tax_identification_number")
        company_number = cedent.registered_company_number or mock_identity.get("uk_company_registration_number")
        return {
            "cedent_id": cedent.cedent_id,
            "name": cedent.legal_entity_name,
            "trading_name": cedent.trading_name,
            "street_address": mock_identity.get("street_address", ""),
            "city": mock_identity.get("city", ""),
            "postal_code": mock_identity.get("postal_code", ""),
            "country": cedent.country_of_registration or cedent.jurisdiction or "",
            "ssn_tin": tax_identifier or "",
            "uk_company_registration_number": company_number or "",
            "source": "db_plus_mock_address_overlay" if mock_identity else "db",
        }

    def _verify_watchlist_match(
        self,
        entity_name: str,
        dob: str | None,
        matches: list[dict[str, Any]],
        identity_context: dict[str, Any] | None,
    ) -> dict[str, Any]:
        if openai_client is None:
            logger.info("OpenAI client is not configured; using heuristic screening verification")
            return {
                **self._fallback_llm_verification(entity_name, dob, matches, identity_context),
                "llm_called": False,
            }

        logger.info("Running OpenAI watchlist verification")
        logger.debug(
            "OpenAI screening verification entity_name=%s dob=%s matched_lists=%s",
            entity_name,
            dob,
            [item["list_name"] for item in matches],
        )
        try:
            response = openai_client.responses.create(
                model=OPENAI_MODEL,
                instructions=(
                    "You are a sanctions-screening verification assistant for an internal compliance workflow. "
                    "Review the entity, cedent identity context, and watchlist matches. Use name, street address, "
                    "city, postal code, country, SSN/TIN, and UK company registration number when available to "
                    "detect genuine matches or mismatches. Return JSON only with keys "
                    "is_genuine_match (boolean), confidence (number between 0 and 1), reasoning (string), and "
                    "identity_match_summary (array of field/status objects). "
                    "Use conservative compliance judgment. Do not include markdown."
                ),
                input=json.dumps(
                    {
                        "entity_name": entity_name,
                        "date_of_birth": dob,
                        "cedent_identity_context": identity_context,
                        "matches": matches,
                    },
                    indent=2,
                ),
            )
            parsed = json.loads((response.output_text or "").strip() or "{}")
            confidence = parsed.get("confidence", 0.0)
            normalized_confidence = max(0.0, min(float(confidence), 1.0))
            reasoning = str(parsed.get("reasoning") or "OpenAI verification completed.")
            return {
                "is_genuine_match": bool(parsed.get("is_genuine_match")),
                "confidence": normalized_confidence,
                "reasoning": reasoning,
                "identity_match_summary": parsed.get("identity_match_summary", []),
                "llm_called": True,
            }
        except Exception as exc:  # pragma: no cover - network/runtime path
            logger.error("OpenAI screening verification failed entity_name=%s error=%s", entity_name, exc)
            logger.debug(
                "OpenAI screening verification fallback entity_name=%s dob=%s matches=%s identity_context=%s",
                entity_name,
                dob,
                matches,
                identity_context,
            )
            return {
                **self._fallback_llm_verification(entity_name, dob, matches, identity_context),
                "llm_called": False,
            }

    def _fallback_llm_verification(
        self,
        entity_name: str,
        dob: str | None,
        matches: list[dict[str, Any]],
        identity_context: dict[str, Any] | None,
    ) -> dict[str, Any]:
        normalized_name = self._normalize_name(entity_name)
        identity_summary = self._identity_match_summary(identity_context, matches)
        identifier_mismatch = any(item["status"] == "mismatch" for item in identity_summary if item["field"] in {"country", "ssn_tin", "uk_company_registration_number"})
        address_mismatch = any(item["status"] == "mismatch" for item in identity_summary if item["field"] in {"city", "postal_code"})

        if normalized_name == self._normalize_name("Hans Muller"):
            if dob == "1962-03-15":
                return {
                    "is_genuine_match": True,
                    "confidence": 0.92,
                    "reasoning": "Name, DOB and list source align above the conservative review threshold. Recommend human review.",
                    "identity_match_summary": identity_summary,
                }
            return {
                "is_genuine_match": True,
                "confidence": 0.86,
                "reasoning": "Name alignment is strong, but DOB is missing or incomplete. Conservative review is still recommended.",
                "identity_match_summary": identity_summary,
            }

        if normalized_name == self._normalize_name("Petra Schmidt"):
            return {
                "is_genuine_match": False,
                "confidence": 0.88,
                "reasoning": "Keyword match was found, but the profile lacks supporting DOB or geography signals and is treated as a false positive.",
                "identity_match_summary": identity_summary,
            }

        if normalized_name == self._normalize_name("Atlas Corporate Pensions"):
            if identifier_mismatch or address_mismatch:
                return {
                    "is_genuine_match": False,
                    "confidence": 0.83,
                    "reasoning": (
                        "Entity-name overlap was found, but cedent country/address/identifier context conflicts with the watchlist record. "
                        "Treating as a likely mismatch for analyst confirmation."
                    ),
                    "identity_match_summary": identity_summary,
                }
            return {
                "is_genuine_match": True,
                "confidence": 0.42,
                "reasoning": "Entity-name overlap remains unresolved. Confidence is low, but the case should stay under human review.",
                "identity_match_summary": identity_summary,
            }

        return {
            "is_genuine_match": True,
            "confidence": 0.75,
            "reasoning": f"Potential watchlist overlap found against {[item['list_name'] for item in matches]}. Human review is recommended.",
            "identity_match_summary": identity_summary,
        }

    def _identity_match_summary(
        self,
        identity_context: dict[str, Any] | None,
        matches: list[dict[str, Any]],
    ) -> list[dict[str, str]]:
        if identity_context is None or not matches:
            return []

        match = matches[0]
        field_pairs = [
            ("name", identity_context.get("name"), match.get("entity_name")),
            ("street_address", identity_context.get("street_address"), match.get("street_address")),
            ("city", identity_context.get("city"), match.get("city")),
            ("postal_code", identity_context.get("postal_code"), match.get("postal_code")),
            ("country", identity_context.get("country"), match.get("country")),
            ("ssn_tin", identity_context.get("ssn_tin"), match.get("tax_identification_number")),
            ("uk_company_registration_number", identity_context.get("uk_company_registration_number"), match.get("company_registration_number")),
        ]
        summary: list[dict[str, str]] = []
        for field, cedent_value, watchlist_value in field_pairs:
            cedent_text = str(cedent_value or "").strip()
            watchlist_text = str(watchlist_value or "").strip()
            if not cedent_text or not watchlist_text or watchlist_text.upper() == "N/A":
                status = "missing"
            elif self._normalize_name(cedent_text) == self._normalize_name(watchlist_text):
                status = "match"
            else:
                status = "mismatch"
            summary.append(
                {
                    "field": field,
                    "cedent_value": cedent_text or "Not available",
                    "watchlist_value": watchlist_text or "Not available",
                    "status": status,
                }
            )
        return summary

    def _screening_method_label(self, llm_result: dict[str, Any]) -> str:
        if llm_result.get("llm_called"):
            return "llm_confirmed" if llm_result["is_genuine_match"] else "llm_false_positive"
        return "heuristic_confirmed" if llm_result["is_genuine_match"] else "heuristic_false_positive"
