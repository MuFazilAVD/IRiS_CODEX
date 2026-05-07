from __future__ import annotations

from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.mock_data_loader import load_mock_data
from app.models.report import Report


class ReportsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_reports(self) -> list[Report]:
        statement = select(Report).where(Report.is_active.is_(True)).order_by(Report.category, Report.report_id)
        return list(self.db.scalars(statement))

    def get_report_by_id(self, report_id: str) -> Report | None:
        statement = select(Report).where(Report.report_id == report_id, Report.is_active.is_(True))
        return self.db.scalar(statement)

    def get_report_previews(self) -> dict[str, Any]:
        return deepcopy(load_mock_data("report_previews.json"))
