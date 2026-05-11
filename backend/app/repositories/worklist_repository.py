from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cedent import Cedent
from app.models.screening_event import ScreeningEvent
from app.models.user import User
from app.models.worklist import WorklistItem


class WorklistRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_claims_ops_items(self) -> list[WorklistItem]:
        statement = select(WorklistItem).where(WorklistItem.assigned_role == "claims_ops").order_by(WorklistItem.wl_id)
        return list(self.db.scalars(statement))

    def list_screening_events(self) -> list[ScreeningEvent]:
        statement = select(ScreeningEvent).order_by(ScreeningEvent.created_at.desc(), ScreeningEvent.screening_ref.desc())
        return list(self.db.scalars(statement))

    def get_by_wl_id(self, wl_id: str) -> WorklistItem | None:
        return self.db.scalar(select(WorklistItem).where(WorklistItem.wl_id == wl_id))

    def list_cedent_names(self, cedent_ids: list[str]) -> dict[str, str]:
        if not cedent_ids:
            return {}

        statement = select(Cedent.cedent_id, Cedent.legal_entity_name).where(Cedent.cedent_id.in_(cedent_ids))
        return {cedent_id: legal_entity_name for cedent_id, legal_entity_name in self.db.execute(statement).all()}

    def list_user_emails(self, user_ids: list[str]) -> dict[str, str]:
        if not user_ids:
            return {}

        statement = select(User.id, User.email).where(User.id.in_(user_ids))
        return {user_id: email for user_id, email in self.db.execute(statement).all()}

    def update(self, item: WorklistItem) -> WorklistItem:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item
