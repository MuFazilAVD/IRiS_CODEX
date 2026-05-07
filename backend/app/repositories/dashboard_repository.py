from __future__ import annotations

from app.mock_data_loader import load_mock_data


class DashboardRepository:
    def get_kpis(self) -> dict:
        return load_mock_data("dashboard_kpis.json")

    def get_intelligence(self) -> dict:
        return load_mock_data("intelligence_feeds_complete.json")

    def get_graphs(self) -> dict:
        return load_mock_data("graph_data.json")

    def get_recent_activities(self) -> dict:
        return load_mock_data("recent_activities.json")
