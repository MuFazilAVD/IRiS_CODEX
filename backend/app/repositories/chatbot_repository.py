from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import desc, func, inspect, select, text
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent
from app.models.cedent import Cedent
from app.models.cession_file import CessionFile
from app.models.contract import Contract
from app.models.population import PolicyRegister
from app.models.worklist import WorklistItem


class ChatbotRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_table_catalog(self) -> list[dict[str, Any]]:
        inspector = inspect(self.db.get_bind())
        catalog: list[dict[str, Any]] = []
        for table_name in sorted(inspector.get_table_names()):
            columns = [
                {
                    "name": column["name"],
                    "type": str(column["type"]),
                }
                for column in inspector.get_columns(table_name)
            ]
            catalog.append({"table_name": table_name, "columns": columns})
        return catalog

    def execute_readonly_query(self, query: str, max_rows: int = 200) -> dict[str, Any]:
        result = self.db.execute(text(query))
        fetched_rows = result.fetchmany(max_rows + 1)
        truncated = len(fetched_rows) > max_rows
        rows = fetched_rows[:max_rows]
        return {
            "columns": list(result.keys()),
            "rows": [self._serialize_row(dict(row._mapping)) for row in rows],
            "row_count": len(rows),
            "truncated": truncated,
        }

    def get_contract(self, contract_id: str) -> Contract | None:
        return self.db.get(Contract, contract_id)

    def list_all_contracts(self) -> list[Contract]:
        return list(self.db.scalars(select(Contract).order_by(Contract.contract_id)))

    def get_cedent(self, cedent_id: str) -> Cedent | None:
        return self.db.get(Cedent, cedent_id)

    def list_all_cedents(self) -> list[Cedent]:
        return list(self.db.scalars(select(Cedent).order_by(Cedent.cedent_id)))

    def count_active_contracts_for_cedent(self, cedent_id: str) -> int:
        statement = (
            select(func.count())
            .select_from(Contract)
            .where(Contract.cedent_id == cedent_id, Contract.status == "active")
        )
        return int(self.db.scalar(statement) or 0)

    def count_current_population_for_contract(self, contract_id: str) -> int:
        statement = (
            select(func.count())
            .select_from(PolicyRegister)
            .where(PolicyRegister.contract_id == contract_id, PolicyRegister.is_current.is_(True))
        )
        return int(self.db.scalar(statement) or 0)

    def list_recent_cession_files(self, limit: int = 3) -> list[CessionFile]:
        statement = (
            select(CessionFile)
            .order_by(desc(CessionFile.received_at), desc(CessionFile.file_id))
            .limit(limit)
        )
        return list(self.db.scalars(statement))

    def list_worklist_items_for_role(self, role: str, limit: int = 5) -> list[WorklistItem]:
        statement = (
            select(WorklistItem)
            .where(WorklistItem.assigned_role == role)
            .order_by(desc(WorklistItem.created_at), desc(WorklistItem.wl_id))
            .limit(limit)
        )
        return list(self.db.scalars(statement))

    def list_recent_audit_events(self, limit: int = 5) -> list[AuditEvent]:
        statement = select(AuditEvent).order_by(desc(AuditEvent.timestamp), desc(AuditEvent.created_at)).limit(limit)
        return list(self.db.scalars(statement))

    def _serialize_row(self, row: dict[str, Any]) -> dict[str, Any]:
        return {key: self._serialize_value(value) for key, value in row.items()}

    def _serialize_value(self, value: Any) -> Any:
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return value
