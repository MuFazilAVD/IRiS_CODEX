from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.worklist import WorklistItem


class WorklistRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_claims_ops_items(self) -> list[WorklistItem]:
        statement = select(WorklistItem).where(WorklistItem.assigned_role == "claims_ops").order_by(WorklistItem.wl_id)
        return list(self.db.scalars(statement))

    def get_by_wl_id(self, wl_id: str) -> WorklistItem | None:
        return self.db.scalar(select(WorklistItem).where(WorklistItem.wl_id == wl_id))

    def update(self, item: WorklistItem) -> WorklistItem:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

