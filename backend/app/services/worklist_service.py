from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.errors import IrisAPIError
from app.mock_data_loader import load_mock_data
from app.models.worklist import WorklistItem
from app.repositories.worklist_repository import WorklistRepository


logger = logging.getLogger(__name__)

WORKLIST_CORRECTIONS: dict[str, dict[str, Any]] = {
    "WL-9202": {
        "title": "Data normalization failure - missing DOB (120 records)",
        "description": "Normalization failed due to missing Date of Birth (DOB) values in 120 records. Mortality calculations are blocked until data is resolved or imputed.",
        "category": "Normalization Failure",
        "source": "AI Agent",
        "ai_generated": True,
        "breadcrumb": "Data Quality · Blocking",
    }
}


class WorklistService:
    def __init__(self, repository: WorklistRepository) -> None:
        self.repository = repository

    def _format_elapsed(self, item: WorklistItem) -> tuple[str, bool, bool]:
        now = datetime.now(timezone.utc)
        is_overdue = bool(item.sla_deadline and item.sla_deadline.replace(tzinfo=timezone.utc) < now)
        if item.elapsed_minutes is None:
            return "0m", False, is_overdue

        total_minutes = abs(item.elapsed_minutes)
        hours, minutes = divmod(total_minutes, 60)
        display = f"{hours}h {minutes}m" if hours else f"{minutes}m"
        is_approaching = not is_overdue and bool(item.sla_deadline and total_minutes >= 300)
        if is_overdue:
            display = f"Overdue {display}"
        return display, is_approaching, is_overdue

    def _serialize_db_item(self, item: WorklistItem) -> dict[str, Any]:
        elapsed_display, is_approaching, is_overdue = self._format_elapsed(item)
        payload = {
            "wl_id": item.wl_id,
            "title": item.title,
            "description": item.description,
            "category": item.category,
            "priority": item.priority,
            "status": item.status,
            "assigned_role": item.assigned_role,
            "contract_id": item.contract_id,
            "cedent_id": item.cedent_id,
            "source": item.source,
            "ai_generated": item.ai_generated,
            "compliance_hold": item.compliance_hold,
            "elapsed_display": elapsed_display,
            "is_approaching": is_approaching,
            "is_overdue": is_overdue,
            "breadcrumb": item.breadcrumb,
        }
        payload.update(WORKLIST_CORRECTIONS.get(item.wl_id, {}))
        return payload

    def _build_summary(self, items: list[dict[str, Any]]) -> dict[str, int]:
        return {
            "my_critical": sum(1 for item in items if item["priority"] == "critical"),
            "overdue": sum(1 for item in items if item.get("is_overdue")),
            "pending_approvals": sum(1 for item in items if item["status"] == "pending_review"),
            "compliance_holds": sum(1 for item in items if item.get("compliance_hold")),
            "ai_exception_queue": sum(1 for item in items if item.get("ai_generated")),
            "team_backlog": len(items),
            "awaiting_review": sum(1 for item in items if item["status"] in {"pending_review", "in_progress"}),
        }

    def get_worklist(self, role: str) -> dict:
        logger.info("Loading worklist for role")
        logger.debug("Worklist role=%s", role)
        if role == "claims_ops":
            serialized_items = [self._serialize_db_item(item) for item in self.repository.list_claims_ops_items()]
            return {
                "summary": self._build_summary(serialized_items),
                "total": len(serialized_items),
                "items": serialized_items,
            }

        mock_payload = load_mock_data(f"worklist_{role}.json")
        return mock_payload

    def update_worklist_item(self, role: str, wl_id: str, status: str | None, assigned_to: str | None) -> dict:
        logger.info("Updating worklist item")
        logger.debug("Worklist update role=%s wl_id=%s status=%s", role, wl_id, status)
        if role != "claims_ops":
            mock_payload = load_mock_data(f"worklist_{role}.json")
            for item in mock_payload["items"]:
                if item["wl_id"] == wl_id:
                    if status:
                        item["status"] = status
                    if assigned_to:
                        item["assigned_to"] = assigned_to
                    return item
            logger.error("Mock worklist item not found wl_id=%s", wl_id)
            raise IrisAPIError(404, "Worklist item not found", f"{wl_id} is not present for role {role}")

        item = self.repository.get_by_wl_id(wl_id)
        if item is None:
            logger.error("DB worklist item not found wl_id=%s", wl_id)
            raise IrisAPIError(404, "Worklist item not found", f"{wl_id} does not exist")

        if status:
            item.status = status
        if assigned_to:
            item.assigned_to = assigned_to
        updated_item = self.repository.update(item)
        return self._serialize_db_item(updated_item)
