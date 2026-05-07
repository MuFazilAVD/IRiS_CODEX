from __future__ import annotations

import logging

from app.repositories.dashboard_repository import DashboardRepository


logger = logging.getLogger(__name__)


class DashboardService:
    def __init__(self, repository: DashboardRepository) -> None:
        self.repository = repository

    def get_kpis(self, role: str) -> dict:
        logger.info("Loading dashboard KPI payload")
        logger.debug("Dashboard KPI role=%s", role)
        payload = self.repository.get_kpis()
        if role not in payload:
            logger.error("Dashboard KPI payload missing role=%s", role)
            raise KeyError(role)
        role_payload = dict(payload[role])
        intelligence_items = self._normalize_intelligence_items(role, self.repository.get_intelligence().get(role, []))
        role_payload["insight"] = self._build_insight_banner(intelligence_items, role_payload.get("insight", ""))
        return {"role": role, **role_payload}

    def get_intelligence(self, role: str) -> dict:
        logger.info("Loading dashboard intelligence feed")
        logger.debug("Dashboard intelligence role=%s", role)
        payload = self.repository.get_intelligence()
        return {"role": role, "items": self._normalize_intelligence_items(role, payload.get(role, []))}

    def get_graphs(self, role: str) -> dict:
        logger.info("Loading dashboard graph payload")
        logger.debug("Dashboard graphs role=%s", role)
        payload = self.repository.get_graphs()
        return {"role": role, "graphs": payload.get(role, [])}

    def get_recent_activities(self) -> dict:
        logger.info("Loading admin recent activities feed")
        return self.repository.get_recent_activities()

    def _normalize_intelligence_items(self, role: str, items: list[dict]) -> list[dict]:
        normalized_items: list[dict] = []
        for index, item in enumerate(items, start=1):
            normalized_items.append(
                {
                    "id": item.get("id") or f"{role}-intel-{index:03d}",
                    "module": item.get("module") or role.upper(),
                    "cedant": item.get("cedant") or "Platform",
                    "period": item.get("period") or "Current cycle",
                    "sla": item.get("sla") or "Review",
                    "flag": item.get("flag") or "FYI",
                    "priority": item.get("priority") or "LOW",
                    "contract_id": item.get("contract_id") or "N/A",
                    "contract_type": item.get("contract_type") or "Operational Event",
                    "message": item.get("message") or "",
                    "impact": item.get("impact") or "No additional impact provided.",
                    "action_label": item.get("action_label") or "Open",
                    "action": self._normalize_action(item.get("action")),
                }
            )
        return normalized_items

    def _build_insight_banner(self, items: list[dict], fallback: str) -> str:
        if not items:
            return fallback
        lead = items[0]
        message = str(lead.get("message") or "").strip()
        impact = str(lead.get("impact") or "").strip()
        if message and impact:
            return f"{message} {impact}"
        return message or impact or fallback

    def _normalize_action(self, action: str | None) -> str:
        if not action:
            return "navigate:/dashboard"
        if action.startswith("navigate:/contracts/"):
            return action.replace("navigate:/contracts/", "navigate:/underwriting/contracts/", 1)
        return action
