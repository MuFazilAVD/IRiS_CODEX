from __future__ import annotations

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.cedent import Cedent
from app.models.cession_file import CessionFile
from app.models.contract import Contract
from app.models.population import PolicyRegister
from app.models.worklist import WorklistItem


class ChatbotRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

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
