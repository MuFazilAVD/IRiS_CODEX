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


CATALOG_COLUMN_HINTS: dict[str, dict[str, Any]] = {
    "cession_file_records": {
        "notes": (
            "Settlement pipeline reconciliation data for uploaded cession files is stored in the "
            "mapped_data JSON column. Use SQLite json_extract(mapped_data, '$.path') to query it. "
            "For multi-row Settlement files, sum uploaded values from record-level fields such as "
            "$.fixed_leg, $.floating_leg, $.fee, $.interest_prior_period, and $.net_settlement_amount "
            "across rows. Do not sum $.settlement_reconciliation.system.* across rows because those "
            "diagnostic values can repeat a file-level system expectation."
        ),
        "json_columns": [
            {
                "name": "mapped_data",
                "paths": [
                    "$.contract_id",
                    "$.calculation_period",
                    "$.payment_date",
                    "$.currency",
                    "$.fixed_leg",
                    "$.floating_leg",
                    "$.fee",
                    "$.interest_prior_period",
                    "$.net_settlement_amount",
                    "$.settlement_reconciliation.settlement_id",
                    "$.settlement_reconciliation.decision",
                    "$.settlement_reconciliation.expected_source",
                    "$.settlement_reconciliation.uploaded.fixed_leg",
                    "$.settlement_reconciliation.uploaded.floating_leg",
                    "$.settlement_reconciliation.uploaded.fee",
                    "$.settlement_reconciliation.uploaded.interest_prior_period",
                    "$.settlement_reconciliation.uploaded.net_settlement_amount",
                    "$.settlement_reconciliation.system.fixed_leg",
                    "$.settlement_reconciliation.system.floating_leg",
                    "$.settlement_reconciliation.system.fee",
                    "$.settlement_reconciliation.system.interest_prior_period",
                    "$.settlement_reconciliation.system.net_settlement_amount",
                ],
            }
        ],
    },
    "cession_files": {
        "notes": (
            "Join to cession_file_records on cession_files.id = cession_file_records.cession_file_id for "
            "pipeline-level settlement questions. For processed Settlement files, also join settlements on "
            "settlements.cession_file_id = cession_files.id to retrieve the authoritative file-level IRiS "
            "system totals instead of summing repeated row diagnostics."
        )
    },
    "settlements": {
        "notes": (
            "Processed Settlement files can create one linked settlements row through settlements.cession_file_id. "
            "That linked row is the authoritative file-level IRiS system result for fixed leg, floating leg, "
            "net amount, currency, status, and period when answering settlement pipeline reconciliation questions."
        )
    },
}


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
            table_entry: dict[str, Any] = {"table_name": table_name, "columns": columns}
            table_entry.update(CATALOG_COLUMN_HINTS.get(table_name, {}))
            catalog.append(table_entry)
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
