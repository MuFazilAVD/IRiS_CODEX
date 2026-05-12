from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.mock_data_loader import load_mock_data
from app.models.cedent import Cedent
from app.models.contract import Contract
from app.models.screening_cache_list import ScreeningCacheList
from app.models.screening_event import ScreeningEvent


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

    def list_contracts_for_cedent(self, cedent_id: str | None) -> list[Contract]:
        if not cedent_id:
            return []
        statement = (
            select(Contract)
            .where(Contract.cedent_id == cedent_id)
            .order_by(Contract.inception_date.desc(), Contract.contract_id.desc())
        )
        return list(self.db.scalars(statement))

    def get_cedent(self, cedent_id: str | None) -> Cedent | None:
        if not cedent_id:
            return None
        return self.db.get(Cedent, cedent_id)

    def find_cedent_by_name(self, entity_name: str | None) -> Cedent | None:
        if not entity_name:
            return None
        normalized_name = entity_name.strip().lower()
        if not normalized_name:
            return None
        statement = (
            select(Cedent)
            .where(
                func.lower(Cedent.legal_entity_name) == normalized_name
            )
            .limit(1)
        )
        return self.db.scalar(statement)

    def list_screening_events(self) -> list[ScreeningEvent]:
        statement = select(ScreeningEvent).order_by(ScreeningEvent.created_at.desc(), ScreeningEvent.screening_ref.desc())
        return list(self.db.scalars(statement))

    def get_screening_event(self, screening_ref: str) -> ScreeningEvent | None:
        statement = select(ScreeningEvent).where(ScreeningEvent.screening_ref == screening_ref).limit(1)
        return self.db.scalar(statement)

    def create_screening_event(self, event: ScreeningEvent) -> ScreeningEvent:
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def update_screening_event(self, event: ScreeningEvent) -> ScreeningEvent:
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def list_screening_cache_lists(self, list_names: list[str] | None = None) -> list[ScreeningCacheList]:
        statement = select(ScreeningCacheList).where(ScreeningCacheList.status == "active")
        if list_names:
            statement = statement.where(ScreeningCacheList.list_name.in_(list_names))
        statement = statement.order_by(ScreeningCacheList.list_name.asc())
        return list(self.db.scalars(statement))

    def get_screening_cache_list(self, list_name: str) -> ScreeningCacheList | None:
        statement = select(ScreeningCacheList).where(ScreeningCacheList.list_name == list_name).limit(1)
        return self.db.scalar(statement)

    def update_screening_cache_list(self, item: ScreeningCacheList) -> ScreeningCacheList:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item
