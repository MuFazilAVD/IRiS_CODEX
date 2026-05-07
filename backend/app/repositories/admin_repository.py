from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.mock_data_loader import load_mock_data
from app.models.audit_event import AuditEvent
from app.models.reference_data_version import ReferenceDataVersion
from app.models.screening_cache_list import ScreeningCacheList
from app.models.user import User


MOCK_STATE_PATH = Path(__file__).resolve().parent.parent / "mock_data" / "admin_state.json"


class AdminRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_users(self) -> list[User]:
        return list(self.db.scalars(select(User).order_by(User.full_name, User.email)))

    def get_user_by_id(self, user_id: str) -> User | None:
        return self.db.get(User, user_id)

    def get_user_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def create_user(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_user(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def list_access_events(self) -> list[AuditEvent]:
        statement = select(AuditEvent).where(AuditEvent.module == "access").order_by(AuditEvent.timestamp.desc())
        return list(self.db.scalars(statement))

    def create_audit_event(self, event: AuditEvent) -> AuditEvent:
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def get_next_audit_id(self, timestamp_prefix: str) -> str:
        statement = (
            select(func.count(AuditEvent.id))
            .where(AuditEvent.audit_id.like(f"AUD-{timestamp_prefix}-%"))
        )
        count = self.db.scalar(statement) or 0
        return f"AUD-{timestamp_prefix}-{count + 1:03d}"

    def list_reference_versions(self, data_type: str | None = None) -> list[ReferenceDataVersion]:
        statement = select(ReferenceDataVersion).order_by(ReferenceDataVersion.created_at.asc(), ReferenceDataVersion.ref_id)
        if data_type:
            statement = statement.where(ReferenceDataVersion.data_type == data_type)
        return list(self.db.scalars(statement))

    def get_reference_version(self, ref_id: str) -> ReferenceDataVersion | None:
        statement = select(ReferenceDataVersion).where(ReferenceDataVersion.ref_id == ref_id)
        return self.db.scalar(statement)

    def create_reference_version(self, version: ReferenceDataVersion) -> ReferenceDataVersion:
        self.db.add(version)
        self.db.commit()
        self.db.refresh(version)
        return version

    def list_screening_cache_lists(self) -> list[ScreeningCacheList]:
        statement = select(ScreeningCacheList).order_by(ScreeningCacheList.created_at.asc(), ScreeningCacheList.list_name)
        return list(self.db.scalars(statement))

    def get_screening_cache_list(self, list_name: str) -> ScreeningCacheList | None:
        statement = select(ScreeningCacheList).where(ScreeningCacheList.list_name == list_name)
        return self.db.scalar(statement)

    def update_screening_cache_list(self, item: ScreeningCacheList) -> ScreeningCacheList:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def load_state(self) -> dict[str, Any]:
        with MOCK_STATE_PATH.open("r", encoding="utf-8") as file:
            return json.load(file)

    def save_state(self, state: dict[str, Any]) -> None:
        with MOCK_STATE_PATH.open("w", encoding="utf-8") as file:
            json.dump(state, file, indent=2)

    def get_integration_health(self) -> list[dict[str, Any]]:
        return list(load_mock_data("integration_health.json"))

    def get_pending_approvals(self) -> list[dict[str, Any]]:
        return list(load_mock_data("pending_approvals.json"))
