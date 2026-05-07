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
        role_payload = payload[role]
        return {"role": role, **role_payload}

    def get_intelligence(self, role: str) -> dict:
        logger.info("Loading dashboard intelligence feed")
        logger.debug("Dashboard intelligence role=%s", role)
        payload = self.repository.get_intelligence()
        return {"role": role, "items": payload.get(role, [])}

    def get_graphs(self, role: str) -> dict:
        logger.info("Loading dashboard graph payload")
        logger.debug("Dashboard graphs role=%s", role)
        payload = self.repository.get_graphs()
        return {"role": role, "graphs": payload.get(role, [])}

    def get_recent_activities(self) -> dict:
        logger.info("Loading admin recent activities feed")
        return self.repository.get_recent_activities()

