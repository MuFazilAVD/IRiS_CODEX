from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.cedent import Cedent
from app.models.contract import Contract
from app.models.population import PolicyRegister
from app.models.worklist import WorklistItem


class UnderwritingRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_cedents(
        self,
        search: str | None,
        status: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Cedent], int]:
        filters = []
        if search:
            search_term = f"%{search.lower()}%"
            filters.append(
                or_(
                    func.lower(Cedent.cedent_id).like(search_term),
                    func.lower(Cedent.legal_entity_name).like(search_term),
                    func.lower(func.coalesce(Cedent.country_of_registration, "")).like(search_term),
                )
            )

        if status and status != "all":
            filters.append(Cedent.status == status)

        total_statement = select(func.count()).select_from(Cedent).where(*filters)
        total = self.db.scalar(total_statement) or 0

        statement = (
            select(Cedent)
            .where(*filters)
            .order_by(Cedent.cedent_id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(statement))
        return items, total

    def list_all_cedents(self) -> list[Cedent]:
        return list(self.db.scalars(select(Cedent).order_by(Cedent.cedent_id)))

    def get_cedent(self, cedent_id: str) -> Cedent | None:
        return self.db.get(Cedent, cedent_id)

    def create_cedent(self, cedent: Cedent) -> Cedent:
        self.db.add(cedent)
        self.db.commit()
        self.db.refresh(cedent)
        return cedent

    def update_cedent(self, cedent: Cedent) -> Cedent:
        self.db.add(cedent)
        self.db.commit()
        self.db.refresh(cedent)
        return cedent

    def list_contracts_for_cedent(self, cedent_id: str) -> list[Contract]:
        statement = select(Contract).where(Contract.cedent_id == cedent_id).order_by(Contract.contract_id)
        return list(self.db.scalars(statement))

    def list_contracts(
        self,
        cedent_id: str | None,
        search: str | None,
        status: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Contract], int]:
        filters = []
        if cedent_id:
            filters.append(Contract.cedent_id == cedent_id)

        if search:
            search_term = f"%{search.lower()}%"
            filters.append(
                or_(
                    func.lower(Contract.contract_id).like(search_term),
                    func.lower(Contract.contract_name).like(search_term),
                    func.lower(func.coalesce(Contract.cedent_id, "")).like(search_term),
                )
            )

        if status and status != "all":
            filters.append(Contract.status == status)

        total_statement = select(func.count()).select_from(Contract).where(*filters)
        total = self.db.scalar(total_statement) or 0

        statement = (
            select(Contract)
            .where(*filters)
            .order_by(Contract.inception_date.desc(), Contract.contract_id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(statement))
        return items, total

    def list_all_contracts(self) -> list[Contract]:
        return list(self.db.scalars(select(Contract).order_by(Contract.contract_id)))

    def get_contract(self, contract_id: str) -> Contract | None:
        return self.db.get(Contract, contract_id)

    def list_population_members(
        self,
        cedent_id: str | None,
        contract_id: str | None,
        status: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[PolicyRegister], int]:
        filters = [PolicyRegister.is_current.is_(True)]
        if cedent_id:
            filters.append(Contract.cedent_id == cedent_id)
        if contract_id:
            filters.append(PolicyRegister.contract_id == contract_id)
        if status and status != "all":
            filters.append(PolicyRegister.status == status)

        total_statement = (
            select(func.count())
            .select_from(PolicyRegister)
            .join(Contract, Contract.contract_id == PolicyRegister.contract_id)
            .where(*filters)
        )
        total = self.db.scalar(total_statement) or 0

        statement = (
            select(PolicyRegister)
            .join(Contract, Contract.contract_id == PolicyRegister.contract_id)
            .where(*filters)
            .order_by(PolicyRegister.contract_id, PolicyRegister.member_id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(statement))
        return items, total

    def get_current_population_member(self, member_id: str) -> PolicyRegister | None:
        statement = (
            select(PolicyRegister)
            .where(PolicyRegister.member_id == member_id, PolicyRegister.is_current.is_(True))
            .limit(1)
        )
        return self.db.scalar(statement)

    def list_population_history(self, member_id: str) -> list[PolicyRegister]:
        statement = (
            select(PolicyRegister)
            .where(PolicyRegister.member_id == member_id)
            .order_by(PolicyRegister.effective_from.desc(), PolicyRegister.created_at.desc())
        )
        return list(self.db.scalars(statement))

    def defer_population_member(
        self,
        current_record: PolicyRegister,
        deferred_record: PolicyRegister,
    ) -> PolicyRegister:
        self.db.add(current_record)
        self.db.add(deferred_record)
        self.db.commit()
        self.db.refresh(deferred_record)
        return deferred_record

    def create_contract(self, contract: Contract) -> Contract:
        self.db.add(contract)
        self.db.commit()
        self.db.refresh(contract)
        return contract

    def update_contract(self, contract: Contract) -> Contract:
        self.db.add(contract)
        self.db.commit()
        self.db.refresh(contract)
        return contract

    def get_next_cedent_id(self) -> str:
        current_ids = [cedent.cedent_id for cedent in self.list_all_cedents()]
        numeric_values = []
        for cedent_id in current_ids:
            try:
                numeric_values.append(int(cedent_id.split("-")[-1]))
            except ValueError:
                continue

        next_value = (max(numeric_values) + 1) if numeric_values else 1000
        return f"CED-{next_value:04d}"

    def get_next_contract_id(self, year: int) -> str:
        prefix = f"LSC-{year}-"
        current_ids = [contract.contract_id for contract in self.list_all_contracts()]
        numeric_values = []
        for contract_id in current_ids:
            if not contract_id.startswith(prefix):
                continue
            try:
                numeric_values.append(int(contract_id.split("-")[-1]))
            except ValueError:
                continue

        next_value = (max(numeric_values) + 1) if numeric_values else 1
        return f"{prefix}{next_value:03d}"

    def get_next_worklist_id(self) -> str:
        current_ids = [value for value in self.db.scalars(select(WorklistItem.wl_id))]
        numeric_values = []
        for wl_id in current_ids:
            try:
                numeric_values.append(int(wl_id.split("-")[-1]))
            except ValueError:
                continue

        next_value = (max(numeric_values) + 1) if numeric_values else 9000
        return f"WL-{next_value:04d}"

    def create_worklist_item(self, item: WorklistItem) -> WorklistItem:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item
