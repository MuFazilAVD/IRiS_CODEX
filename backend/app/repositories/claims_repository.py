from __future__ import annotations

from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent
from app.models.cedent import Cedent
from app.models.cession_file import CessionFile
from app.models.cession_file_exception import CessionFileException
from app.models.cession_file_record import CessionFileRecord
from app.models.contract import Contract
from app.models.population import PolicyRegister
from app.models.settlement import Settlement
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

    def get_contract_clause_context(self, contract_id: str) -> dict[str, object] | None:
        statement = text(
            """
            SELECT
              contract_id,
              contract_name,
              contract_version,
              cedent_id,
              status,
              notional_amount,
              currency,
              fixed_leg_rate,
              fixed_leg_frequency,
              floating_leg_definition,
              lives_count,
              inception_date,
              maturity_date
            FROM contracts
            WHERE contract_id = :contract_id
            LIMIT 1
            """
        )
        row = self.db.execute(statement, {"contract_id": contract_id}).mappings().first()
        return dict(row) if row else None

    def get_current_population_count(self, contract_id: str) -> int:
        statement = (
            select(func.count())
            .select_from(PolicyRegister)
            .where(PolicyRegister.contract_id == contract_id, PolicyRegister.is_current.is_(True))
        )
        return int(self.db.scalar(statement) or 0)

    def list_current_population_for_members(
        self,
        contract_id: str,
        member_ids: list[str],
    ) -> list[PolicyRegister]:
        if not member_ids:
            return []
        statement = (
            select(PolicyRegister)
            .where(
                PolicyRegister.contract_id == contract_id,
                PolicyRegister.is_current.is_(True),
                PolicyRegister.member_id.in_(member_ids),
            )
            .order_by(PolicyRegister.member_id, PolicyRegister.created_at)
        )
        return list(self.db.scalars(statement))

    def list_current_population_for_contract(self, contract_id: str) -> list[PolicyRegister]:
        statement = (
            select(PolicyRegister)
            .where(PolicyRegister.contract_id == contract_id, PolicyRegister.is_current.is_(True))
            .order_by(PolicyRegister.member_id, PolicyRegister.created_at)
        )
        return list(self.db.scalars(statement))

    def find_contract_by_member_overlap(self, member_ids: list[str]) -> tuple[str, int] | None:
        if not member_ids:
            return None
        statement = (
            select(PolicyRegister.contract_id, func.count().label("matched_members"))
            .where(
                PolicyRegister.is_current.is_(True),
                PolicyRegister.member_id.in_(member_ids),
            )
            .group_by(PolicyRegister.contract_id)
            .order_by(func.count().desc())
            .limit(1)
        )
        row = self.db.execute(statement).first()
        if row is None:
            return None
        return str(row.contract_id), int(row.matched_members)

    def save_population_records(self, records: list[PolicyRegister]) -> list[PolicyRegister]:
        for record in records:
            self.db.add(record)
        self.db.commit()
        return records

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

    def list_settlements(self) -> list[Settlement]:
        statement = select(Settlement).order_by(Settlement.period_end.desc(), Settlement.settlement_id)
        return list(self.db.scalars(statement))

    def get_settlement(self, settlement_id: str) -> Settlement | None:
        statement = select(Settlement).where(Settlement.settlement_id == settlement_id).limit(1)
        return self.db.scalar(statement)

    def upsert_settlement(self, settlement: Settlement) -> Settlement:
        self.db.add(settlement)
        self.db.commit()
        self.db.refresh(settlement)
        return settlement

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

    def list_audit_events_for_cession_file(self, file_id: str, cession_file_db_id: str | None = None) -> list[AuditEvent]:
        filters = [AuditEvent.entity_id == file_id]
        if cession_file_db_id:
            filters.append(AuditEvent.cession_file_id == cession_file_db_id)
        statement = (
            select(AuditEvent)
            .where(or_(*filters))
            .order_by(AuditEvent.timestamp.desc(), AuditEvent.created_at.desc())
        )
        return list(self.db.scalars(statement))

    def list_audit_events_for_settlement(self, settlement_id: str) -> list[AuditEvent]:
        statement = (
            select(AuditEvent)
            .where(or_(AuditEvent.settlement_id == settlement_id, AuditEvent.entity_id == settlement_id))
            .order_by(AuditEvent.timestamp.desc(), AuditEvent.created_at.desc())
        )
        return list(self.db.scalars(statement))

    def create_audit_event(self, event: AuditEvent) -> AuditEvent:
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def get_next_audit_id(self, timestamp_prefix: str) -> str:
        statement = select(func.count(AuditEvent.id)).where(AuditEvent.audit_id.like(f"AUD-{timestamp_prefix}-%"))
        count = self.db.scalar(statement) or 0
        return f"AUD-{timestamp_prefix}-{count + 1:03d}"
