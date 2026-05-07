import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ReferenceDataVersion(Base):
    __tablename__ = "reference_data_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ref_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    data_type: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    source: Mapped[str] = mapped_column(String(200), nullable=True)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    locked_by: Mapped[str] = mapped_column(String(36), nullable=True)
    locked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    contracts_using: Mapped[int] = mapped_column(Integer, default=0)
    data_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[str] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
