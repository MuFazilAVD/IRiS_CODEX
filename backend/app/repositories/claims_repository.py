from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.cedent import Cedent
from app.models.cession_file import CessionFile
from app.models.cession_file_exception import CessionFileException
from app.models.cession_file_record import CessionFileRecord
from app.models.contract import Contract
from app.models.worklist import WorklistItem


class ClaimsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_cession_files(
        self,
        status: str | None,
        file_type: str | None,
        cedent_id: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[CessionFile], int]:
        filters = []
        if file_type and file_type != "all":
            filters.append(CessionFile.file_type == file_type)
        if cedent_id:
            filters.append(CessionFile.cedent_id == cedent_id)
        if status == "exceptions":
            filters.append(or_(CessionFile.stage == "exceptions", CessionFile.critical_count > 0))
        elif status == "review":
            filters.append(CessionFile.stage.in_(["validated", "processing", "processed"]))
        elif status == "approved":
            filters.append(CessionFile.stage == "approved")

        total_statement = select(func.count()).select_from(CessionFile).where(*filters)
        total = self.db.scalar(total_statement) or 0

        statement = (
            select(CessionFile)
            .where(*filters)
            .order_by(CessionFile.received_at.desc(), CessionFile.file_id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(self.db.scalars(statement)), total

    def list_all_cession_files(self) -> list[CessionFile]:
        statement = select(CessionFile).order_by(CessionFile.received_at.desc(), CessionFile.file_id)
        return list(self.db.scalars(statement))

    def get_cession_file(self, file_id: str) -> CessionFile | None:
        statement = select(CessionFile).where(CessionFile.file_id == file_id).limit(1)
        return self.db.scalar(statement)

    def create_cession_file(self, cession_file: CessionFile) -> CessionFile:
        self.db.add(cession_file)
        self.db.commit()
        self.db.refresh(cession_file)
        return cession_file

    def update_cession_file(self, cession_file: CessionFile) -> CessionFile:
        self.db.add(cession_file)
        self.db.commit()
        self.db.refresh(cession_file)
        return cession_file

    def get_cedent(self, cedent_id: str | None) -> Cedent | None:
        if not cedent_id:
            return None
        return self.db.get(Cedent, cedent_id)

    def get_contract(self, contract_id: str | None) -> Contract | None:
        if not contract_id:
            return None
        return self.db.get(Contract, contract_id)

    def list_all_contracts(self) -> list[Contract]:
        return list(self.db.scalars(select(Contract).order_by(Contract.contract_id)))

    def list_all_cedents(self) -> list[Cedent]:
        return list(self.db.scalars(select(Cedent).order_by(Cedent.cedent_id)))

    def list_file_records(self, cession_file_db_id: str) -> list[CessionFileRecord]:
        statement = (
            select(CessionFileRecord)
            .where(CessionFileRecord.cession_file_id == cession_file_db_id)
            .order_by(CessionFileRecord.row_number, CessionFileRecord.created_at)
        )
        return list(self.db.scalars(statement))

    def replace_file_records(self, cession_file_db_id: str, records: list[CessionFileRecord]) -> list[CessionFileRecord]:
        existing = self.list_file_records(cession_file_db_id)
        for item in existing:
            self.db.delete(item)
        for item in records:
            self.db.add(item)
        self.db.commit()
        return self.list_file_records(cession_file_db_id)

    def list_file_exceptions(self, cession_file_db_id: str) -> list[CessionFileException]:
        statement = (
            select(CessionFileException)
            .where(CessionFileException.cession_file_id == cession_file_db_id)
            .order_by(CessionFileException.created_at, CessionFileException.row_number)
        )
        return list(self.db.scalars(statement))

    def replace_file_exceptions(
        self,
        cession_file_db_id: str,
        exceptions: list[CessionFileException],
    ) -> list[CessionFileException]:
        existing = self.list_file_exceptions(cession_file_db_id)
        for item in existing:
            self.db.delete(item)
        for item in exceptions:
            self.db.add(item)
        self.db.commit()
        return self.list_file_exceptions(cession_file_db_id)

    def update_file_exceptions(self, exceptions: list[CessionFileException]) -> list[CessionFileException]:
        for item in exceptions:
            self.db.add(item)
        self.db.commit()
        if not exceptions:
            return []
        return self.list_file_exceptions(exceptions[0].cession_file_id)

    def list_worklist_items_for_file(self, cession_file_db_id: str) -> list[WorklistItem]:
        statement = (
            select(WorklistItem)
            .where(WorklistItem.cession_file_id == cession_file_db_id)
            .order_by(WorklistItem.created_at.desc(), WorklistItem.wl_id)
        )
        return list(self.db.scalars(statement))

    def create_worklist_item(self, item: WorklistItem) -> WorklistItem:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def get_next_worklist_id(self) -> str:
        current_ids = [value for value in self.db.scalars(select(WorklistItem.wl_id))]
        numeric_values = []
        for wl_id in current_ids:
            try:
                numeric_values.append(int(wl_id.split("-")[-1]))
            except ValueError:
                continue
        next_value = (max(numeric_values) + 1) if numeric_values else 9300
        return f"WL-{next_value:04d}"

    def get_next_cession_file_id(self, received_year: int) -> str:
        prefix = f"CES-{received_year}-"
        current_ids = [value for value in self.db.scalars(select(CessionFile.file_id))]
        numeric_values = []
        for file_id in current_ids:
            if not file_id.startswith(prefix):
                continue
            try:
                numeric_values.append(int(file_id.split("-")[-1]))
            except ValueError:
                continue
        next_value = (max(numeric_values) + 1) if numeric_values else 1
        return f"{prefix}{next_value:03d}"
