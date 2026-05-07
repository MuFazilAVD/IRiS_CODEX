from __future__ import annotations

from copy import deepcopy
from typing import Any

from sqlalchemy.orm import Session

from app.mock_data_loader import load_mock_data


class AuditRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_events(self) -> list[dict[str, Any]]:
        return deepcopy(load_mock_data("audit_events_seed.json"))

    def list_ai_decisions(self) -> list[dict[str, Any]]:
        return deepcopy(load_mock_data("audit_ai_decisions_seed.json"))

    def list_manual_overrides(self) -> list[dict[str, Any]]:
        return deepcopy(load_mock_data("audit_manual_overrides_seed.json"))

    def list_export_reports(self) -> list[dict[str, Any]]:
        return deepcopy(load_mock_data("audit_export_reports_seed.json"))
