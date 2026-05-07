from __future__ import annotations

import csv
import io
import json
import logging
from collections.abc import Iterable
from datetime import date, datetime, timezone
from typing import Any

from app.errors import IrisAPIError
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import AuditSearchRequest


logger = logging.getLogger(__name__)
UTC = timezone.utc


class AuditService:
    def __init__(self, repository: AuditRepository) -> None:
        self.repository = repository

    def get_dashboard(self) -> dict[str, Any]:
        logger.info("Loading audit dashboard")
        events = self._sorted_events(self.repository.list_events())
        decisions = self.repository.list_ai_decisions()
        latest_business_day = self._latest_event_date(events)
        logger.debug("Audit dashboard latest_business_day=%s event_count=%s", latest_business_day, len(events))
        timeline = [event for event in events if self._event_date(event) == latest_business_day][:6]
        high_impact_changes = [event for event in events if event.get("dashboard_high_impact")][:4]
        ai_pending_review = [item for item in decisions if item.get("human_review_required") or item.get("below_threshold")]
        return {
            "kpis": {
                "audit_events_today": 10,
                "pct_change_vs_7d": 23,
                "high_risk_changes": 7,
                "high_risk_critical": 2,
                "pending_approvals": 3,
                "oldest_pending_hours": 3,
                "manual_overrides": len(self.repository.list_manual_overrides()),
                "ai_decisions_pending_review": len(ai_pending_review),
                "ai_below_confidence": sum(1 for item in decisions if item.get("below_threshold")),
                "failed_screenings": 0,
                "high_financial_impact": len(high_impact_changes),
            },
            "timeline": timeline,
            "high_impact_changes": high_impact_changes,
            "ai_pending_review": ai_pending_review,
        }

    def search_events(self, filters: AuditSearchRequest) -> dict[str, Any]:
        logger.info("Searching audit events")
        logger.debug("Audit search filters=%s", filters.model_dump())
        filtered = self._apply_event_filters(self.repository.list_events(), filters)
        total = len(filtered)
        start = (filters.page - 1) * filters.page_size
        end = start + filters.page_size
        return {
            "total": total,
            "page": filters.page,
            "page_size": filters.page_size,
            "items": filtered[start:end],
        }

    def get_financial_impact(self) -> dict[str, Any]:
        logger.info("Loading audit financial impact changes")
        items = [event for event in self._sorted_events(self.repository.list_events()) if event.get("financial_impact_amount") is not None]
        return {"total": len(items), "items": items}

    def get_approvals(self) -> dict[str, Any]:
        logger.info("Loading audit approval events")
        items = [
            event
            for event in self._sorted_events(self.repository.list_events())
            if event.get("approval_status") != "n/a"
            and (event.get("approval_status") == "pending" or event.get("risk_level") in {"high", "critical"})
        ]
        return {"total": len(items), "items": items}

    def get_ai_decisions(self) -> dict[str, Any]:
        logger.info("Loading audit AI decision log")
        decisions = self._sorted_by_timestamp(self.repository.list_ai_decisions())
        return {
            "kpis": {
                "ai_decisions_logged": len(decisions),
                "below_confidence_floor": sum(1 for item in decisions if item.get("below_threshold")),
                "human_overrides": 0,
            },
            "decisions": decisions,
        }

    def get_manual_overrides(self) -> dict[str, Any]:
        logger.info("Loading audit manual overrides")
        overrides = self._sorted_by_timestamp(self.repository.list_manual_overrides(), field_name="approved_at")
        return {"total": len(overrides), "overrides": overrides}

    def get_reference_data(self) -> dict[str, Any]:
        logger.info("Loading audit reference data trail")
        items = [
            event
            for event in self._sorted_events(self.repository.list_events())
            if event.get("module") == "reference_data" and event.get("event_type") == "Reference Data Update"
        ]
        return {"total": len(items), "items": items}

    def get_access_logs(self) -> dict[str, Any]:
        logger.info("Loading audit access log trail")
        items = [event for event in self._sorted_events(self.repository.list_events()) if event.get("module") == "access"]
        return {"total": len(items), "items": items}

    def get_document_history(self) -> dict[str, Any]:
        logger.info("Loading audit document history")
        items = [event for event in self._sorted_events(self.repository.list_events()) if event.get("document_history")]
        return {"total": len(items), "items": items}

    def get_export_reports(self) -> dict[str, Any]:
        logger.info("Loading audit export report catalog")
        return {"reports": self.repository.list_export_reports()}

    def download_export_report(self, report_name: str, export_format: str) -> dict[str, Any]:
        logger.info("Downloading audit export report")
        logger.debug("Audit report download report_name=%s format=%s", report_name, export_format)
        report = next((item for item in self.repository.list_export_reports() if item.get("name") == report_name), None)
        if report is None:
            logger.error("Audit report download failed because report_name=%s was not found", report_name)
            raise IrisAPIError(404, "Report not found", "The requested audit report does not exist")

        normalized_format = export_format.strip().lower()
        if normalized_format not in {"csv", "json"}:
            logger.error("Audit report download failed because format=%s is invalid", export_format)
            raise IrisAPIError(400, "Invalid format", "Report format must be csv or json")

        payload = self._build_report_payload(report_name)
        filename_root = report_name.lower().replace(" ", "-")
        if normalized_format == "json":
            return {
                "filename": f"{filename_root}.json",
                "content_type": "application/json",
                "content": json.dumps(payload, indent=2),
            }

        return {
            "filename": f"{filename_root}.csv",
            "content_type": "text/csv;charset=utf-8;",
            "content": self._to_csv(payload),
        }

    def _build_report_payload(self, report_name: str) -> dict[str, Any]:
        if report_name == "Audit Report":
            return self.search_events(AuditSearchRequest(page=1, page_size=200))
        if report_name == "Regulatory Review Report":
            return self.get_approvals()
        if report_name == "Compliance Report":
            items = [event for event in self._sorted_events(self.repository.list_events()) if event.get("module") == "compliance"]
            return {"total": len(items), "items": items}
        if report_name == "Override Exception Report":
            return self.get_manual_overrides()
        if report_name == "AI Governance Report":
            return self.get_ai_decisions()
        if report_name == "Financial Impact Report":
            return self.get_financial_impact()

        logger.error("Audit report payload mapping missing for report_name=%s", report_name)
        raise IrisAPIError(404, "Report not found", "The requested audit report does not exist")

    def _apply_event_filters(self, events: list[dict[str, Any]], filters: AuditSearchRequest) -> list[dict[str, Any]]:
        filtered = self._sorted_events(events)
        query = (filters.q or "").strip().lower()
        from_date = self._parse_date(filters.from_date)
        to_date = self._parse_date(filters.to_date)

        if query:
            filtered = [
                event
                for event in filtered
                if query in " ".join(
                    str(event.get(field) or "").lower()
                    for field in ["audit_id", "entity_id", "actor_id", "event_type", "description"]
                )
            ]

        if filters.module != "all":
            filtered = [event for event in filtered if event.get("module") == filters.module]

        if filters.actor != "all":
            filtered = [event for event in filtered if event.get("actor_type") == filters.actor]

        if filters.approval != "all":
            filtered = [event for event in filtered if event.get("approval_status") == filters.approval]

        if filters.impact == "high":
            filtered = [event for event in filtered if event.get("is_high_impact")]

        if filters.risk != "all":
            filtered = [event for event in filtered if event.get("risk_level") == filters.risk]

        if from_date is not None:
            filtered = [event for event in filtered if self._event_date(event) >= from_date]

        if to_date is not None:
            filtered = [event for event in filtered if self._event_date(event) <= to_date]

        return filtered

    def _to_csv(self, payload: dict[str, Any]) -> str:
        rows = self._flatten_payload_for_csv(payload)
        buffer = io.StringIO()
        if not rows:
            writer = csv.writer(buffer)
            writer.writerow(["message"])
            writer.writerow(["No rows available"])
            return buffer.getvalue()

        fieldnames = list(rows[0].keys())
        writer = csv.DictWriter(buffer, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        return buffer.getvalue()

    def _flatten_payload_for_csv(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        for key in ["items", "timeline", "high_impact_changes", "ai_pending_review", "decisions", "overrides", "reports"]:
            value = payload.get(key)
            if isinstance(value, list):
                return [self._flatten_row(item) for item in value]
        return [self._flatten_row(payload)]

    def _flatten_row(self, row: Any) -> dict[str, Any]:
        if not isinstance(row, dict):
            return {"value": row}
        flattened: dict[str, Any] = {}
        for key, value in row.items():
            if isinstance(value, (list, dict)):
                flattened[key] = json.dumps(value)
            else:
                flattened[key] = value
        return flattened

    def _sorted_events(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return self._sorted_by_timestamp(events, field_name="timestamp")

    def _sorted_by_timestamp(self, items: list[dict[str, Any]], field_name: str = "timestamp") -> list[dict[str, Any]]:
        return sorted(items, key=lambda item: item.get(field_name, ""), reverse=True)

    def _latest_event_date(self, events: Iterable[dict[str, Any]]) -> date:
        parsed_dates = [self._event_date(event) for event in events]
        return max(parsed_dates) if parsed_dates else datetime.now(UTC).date()

    def _event_date(self, event: dict[str, Any]) -> date:
        return self._parse_datetime(event.get("timestamp")).date()

    def _parse_datetime(self, value: Any) -> datetime:
        if not isinstance(value, str) or not value:
            return datetime.now(UTC)
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)

    def _parse_date(self, value: str | None) -> date | None:
        if not value:
            return None
        try:
            if "T" in value:
                return self._parse_datetime(value).date()
            return date.fromisoformat(value)
        except ValueError as exc:
            logger.error("Audit filter date parsing failed for value=%s", value)
            raise IrisAPIError(400, "Invalid date", f"Could not parse date value '{value}'") from exc
