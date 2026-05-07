from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cedent import Cedent
from app.models.contract import Contract


class OperationsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_cedent(self, cedent_id: str | None) -> Cedent | None:
        if not cedent_id:
            return None
        return self.db.scalar(select(Cedent).where(Cedent.cedent_id == cedent_id))

    def get_contract(self, contract_id: str | None) -> Contract | None:
        if not contract_id:
            return None
        return self.db.scalar(select(Contract).where(Contract.contract_id == contract_id))

    def list_contracts(self) -> list[Contract]:
        return list(self.db.scalars(select(Contract).order_by(Contract.contract_id)))
