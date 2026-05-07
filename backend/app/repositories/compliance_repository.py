from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.mock_data_loader import load_mock_data
from app.models.cedent import Cedent


class ComplianceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_dashboard_kpis(self) -> dict:
        return load_mock_data("dashboard_kpis.json")

    def get_dashboard_graphs(self) -> dict:
        return load_mock_data("graph_data.json")

    def get_cedent_overrides(self) -> dict:
        return load_mock_data("cedent_detail_overrides.json")

    def list_all_cedents(self) -> list[Cedent]:
        return list(self.db.scalars(select(Cedent).order_by(Cedent.cedent_id)))

    def list_active_cedents(self) -> list[Cedent]:
        statement = (
            select(Cedent)
            .where(Cedent.is_active.is_(True))
            .order_by(Cedent.cedent_id)
        )
        return list(self.db.scalars(statement))
