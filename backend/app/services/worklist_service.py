from __future__ import annotations

from copy import deepcopy
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.errors import IrisAPIError
from app.mock_data_loader import load_mock_data
from app.models.screening_event import ScreeningEvent
from app.models.worklist import WorklistItem
from app.repositories.worklist_repository import WorklistRepository


logger = logging.getLogger(__name__)

WORKLIST_VIEWER_EMAILS: dict[str, str] = {
    "admin": "d.rhodes@reinsure.io",
    "underwriter": "m.patel@reinsure.io",
    "claims_ops": "a.chen@reinsure.io",
    "compliance": "j.morales@reinsure.io",
}

WORKLIST_REGISTER_FILE = "worklist_register.json"
COMPLIANCE_OVERRIDES_FILE = Path(__file__).resolve().parent.parent / "mock_data" / "compliance_overrides.json"
WORKSPACE_TRIGGER_TYPES = {"onboarding", "adhoc", "periodic"}


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

    def _serialize_db_item(
        self,
        item: WorklistItem,
        cedent_names: dict[str, str] | None = None,
        assigned_user_emails: dict[str, str] | None = None,
        assigned_user_names: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        elapsed_display, is_approaching, is_overdue = self._format_elapsed(item)
        return {
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
            "cedent_name": (cedent_names or {}).get(item.cedent_id) if item.cedent_id else None,
            "assigned_to_email": (assigned_user_emails or {}).get(item.assigned_to) if item.assigned_to else None,
            "assigned_to_name": (assigned_user_names or {}).get(item.assigned_to) if item.assigned_to else None,
            "entity_display": self._entity_display(item, cedent_names or {}),
            "action_label": self._action_label(item),
        }

    def _build_summary(self, items: list[dict[str, Any]], role: str) -> dict[str, int]:
        viewer_email = WORKLIST_VIEWER_EMAILS.get(role)
        return {
            "my_critical": sum(
                1
                for item in items
                if item["priority"] == "critical" and viewer_email and item.get("assigned_to_email") == viewer_email
            ),
            "overdue": sum(1 for item in items if item.get("is_overdue")),
            "pending_approvals": sum(
                1 for item in items if item.get("status") == "pending_review" or item.get("action_label") == "Approval req."
            ),
            "compliance_holds": sum(1 for item in items if item.get("compliance_hold")),
            "ai_exception_queue": sum(1 for item in items if item.get("ai_generated")),
            "team_backlog": sum(1 for item in items if item.get("assigned_role") == role),
            "awaiting_review": sum(
                1
                for item in items
                if viewer_email
                and item.get("assigned_to_email") == viewer_email
                and (item.get("status") in {"pending_review", "in_progress"} or item.get("action_label") == "Approval req.")
            ),
        }

    def _build_mock_payload(self, role: str, live_items: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        register_items = deepcopy(load_mock_data(WORKLIST_REGISTER_FILE))
        register_ids = {str(item.get("wl_id") or "") for item in register_items}
        for item in register_items:
            live_state = next((state for state in (live_items or []) if state.get("wl_id") == item["wl_id"]), None)
            if live_state:
                item["status"] = live_state.get("status", item["status"])
                item["action_label"] = live_state.get("action_label", item.get("action_label"))
                item["assigned_role"] = live_state.get("assigned_role", item.get("assigned_role"))
                item["assigned_to_email"] = live_state.get("assigned_to_email", item.get("assigned_to_email"))
                item["assigned_to_name"] = live_state.get("assigned_to_name", item.get("assigned_to_name"))
                item["entity_display"] = live_state.get("entity_display", item.get("entity_display"))

        dynamic_screening_items = self._build_dynamic_screening_worklist_items(register_items)
        appended_live_items = [
            state
            for state in (live_items or [])
            if str(state.get("wl_id") or "") not in register_ids
        ]
        register_items = appended_live_items + dynamic_screening_items + register_items
        self._attach_assignee_names(register_items)

        return {
            "summary": self._build_summary(register_items, role),
            "total": len(register_items),
            "items": register_items,
        }

    def get_worklist(self, role: str) -> dict:
        logger.info("Loading worklist for role")
        logger.debug("Worklist role=%s", role)
        db_items = self.repository.list_live_items()
        cedent_names = self.repository.list_cedent_names([item.cedent_id for item in db_items if item.cedent_id])
        assigned_user_emails = self.repository.list_user_emails([item.assigned_to for item in db_items if item.assigned_to])
        assigned_user_names = self.repository.list_user_names([item.assigned_to for item in db_items if item.assigned_to])
        live_items = [
            self._serialize_db_item(
                item,
                cedent_names=cedent_names,
                assigned_user_emails=assigned_user_emails,
                assigned_user_names=assigned_user_names,
            )
            for item in db_items
        ]
        return self._build_mock_payload(role, live_items=live_items)

    def _entity_display(self, item: WorklistItem, cedent_names: dict[str, str]) -> str | None:
        cedent_name = cedent_names.get(item.cedent_id) if item.cedent_id else None
        if cedent_name and item.contract_id:
            return f"{cedent_name}\n· {item.contract_id}"
        return cedent_name or item.contract_id

    def _action_label(self, item: WorklistItem) -> str | None:
        category = str(item.category or "").strip().lower()
        title = str(item.title or "").strip().lower()
        if category == "settlement pending" or "approval pending" in title:
            return "Approval req."
        if category == "sanction screening" or "screening pending" in title:
            return "Review req."
        return None

    def _build_dynamic_screening_worklist_items(self, existing_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        logger.info("Building dynamic sanctions screening worklist overlays")
        screening_cases = self._read_compliance_override_store().get("screening_cases", {})
        if not screening_cases:
            logger.debug("No dynamic sanctions screening overrides were found for worklist overlays")
            return []

        existing_wl_ids = {str(item.get("wl_id") or "") for item in existing_items}
        existing_titles = {str(item.get("title") or "").strip().lower() for item in existing_items}
        dynamic_items: list[dict[str, Any]] = []

        for event in self.repository.list_screening_events():
            if event.trigger_type not in WORKSPACE_TRIGGER_TYPES:
                continue
            if event.screening_ref not in screening_cases:
                continue
            if event.result != "review":
                continue

            worklist_item = self._serialize_dynamic_screening_worklist_item(event, screening_cases.get(event.screening_ref, {}))
            if worklist_item["wl_id"] in existing_wl_ids or worklist_item["title"].strip().lower() in existing_titles:
                continue
            dynamic_items.append(worklist_item)

        logger.debug("Dynamic sanctions screening worklist overlays count=%s", len(dynamic_items))
        return dynamic_items

    def _attach_assignee_names(self, items: list[dict[str, Any]]) -> None:
        emails = sorted(
            {
                str(item.get("assigned_to_email")).strip()
                for item in items
                if item.get("assigned_to_email") and not item.get("assigned_to_name")
            }
        )
        if not emails:
            return

        logger.debug("Resolving worklist assignee names for %s email(s)", len(emails))
        names_by_email = self.repository.list_user_names_by_email(emails)
        for item in items:
            email = item.get("assigned_to_email")
            if email and not item.get("assigned_to_name"):
                item["assigned_to_name"] = names_by_email.get(str(email).strip())

    def _serialize_dynamic_screening_worklist_item(self, event: ScreeningEvent, context: dict[str, Any]) -> dict[str, Any]:
        matched_lists = [self._watchlist_label(str(item)) for item in (event.matched_lists or [])]
        primary_watchlist = matched_lists[0] if matched_lists else "Sanctions"
        title_watchlist = primary_watchlist if primary_watchlist.endswith("Match") else f"{primary_watchlist} match"
        confidence_pct = int(round((event.llm_confidence or 0.0) * 100))
        now = datetime.now(timezone.utc)
        created_at = event.created_at.replace(tzinfo=timezone.utc) if event.created_at.tzinfo is None else event.created_at.astimezone(timezone.utc)
        elapsed_minutes = max(int((now - created_at).total_seconds() // 60), 0)
        hours, minutes = divmod(elapsed_minutes, 60)
        elapsed_display = f"{hours}h {minutes}m" if hours else f"{minutes}m"
        review_reason = event.llm_reasoning or "Potential sanctions match found in screening cache."
        entity_name = event.entity_name
        return {
            "wl_id": f"WL-{event.screening_ref}",
            "title": f"{title_watchlist} - {entity_name}",
            "description": (
                f"Potential {primary_watchlist} exposure detected for {entity_name}. "
                f"Compliance review is required before the case can be cleared. "
                f"{review_reason}"
            ),
            "category": f"{primary_watchlist} Match" if primary_watchlist != "Sanctions" else "Sanctions Match",
            "priority": "critical" if "OFAC" in matched_lists else "high",
            "status": "pending_review",
            "assigned_role": "compliance",
            "source": "AI Agent",
            "ai_generated": True,
            "compliance_hold": True,
            "elapsed_display": elapsed_display,
            "is_approaching": False,
            "is_overdue": False,
            "breadcrumb": "Compliance Hold - Review Required",
            "cedent_name": entity_name,
            "assigned_to_email": WORKLIST_VIEWER_EMAILS["compliance"],
            "assigned_to_name": None,
            "entity_display": entity_name,
            "financial_impact_display": None,
            "is_high_impact": False,
            "confidence_display": f"{confidence_pct}%",
            "action_label": "Approval req.",
        }

    def _read_compliance_override_store(self) -> dict[str, Any]:
        if not COMPLIANCE_OVERRIDES_FILE.exists():
            return {}
        with COMPLIANCE_OVERRIDES_FILE.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else {}

    def _watchlist_label(self, value: str) -> str:
        if value.startswith("OFAC"):
            return "OFAC"
        if value.startswith("FinCEN"):
            return "FinCEN"
        return value

    def update_worklist_item(self, role: str, wl_id: str, status: str | None, assigned_to: str | None) -> dict:
        logger.info("Updating worklist item")
        logger.debug("Worklist update role=%s wl_id=%s status=%s", role, wl_id, status)
        if role != "claims_ops":
            for item in deepcopy(load_mock_data(WORKLIST_REGISTER_FILE)):
                if item["wl_id"] == wl_id:
                    if status:
                        item["status"] = status
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
        cedent_names = self.repository.list_cedent_names([updated_item.cedent_id] if updated_item.cedent_id else [])
        assigned_user_emails = self.repository.list_user_emails([updated_item.assigned_to] if updated_item.assigned_to else [])
        assigned_user_names = self.repository.list_user_names([updated_item.assigned_to] if updated_item.assigned_to else [])
        serialized = self._serialize_db_item(
            updated_item,
            cedent_names=cedent_names,
            assigned_user_emails=assigned_user_emails,
            assigned_user_names=assigned_user_names,
        )

        for item_payload in deepcopy(load_mock_data(WORKLIST_REGISTER_FILE)):
            if item_payload["wl_id"] == wl_id:
                item_payload["status"] = serialized["status"]
                return item_payload

        return serialized
