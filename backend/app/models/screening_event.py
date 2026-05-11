import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScreeningEvent(Base):
    __tablename__ = "screening_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    screening_ref: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_name: Mapped[str] = mapped_column(String(300), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=True)
    cedent_id: Mapped[str] = mapped_column(String(20), nullable=True)
    contract_id: Mapped[str] = mapped_column(String(30), nullable=True)
    cession_file_id: Mapped[str] = mapped_column(String(36), nullable=True)
    member_id: Mapped[str] = mapped_column(String(50), nullable=True)
    keyword_match: Mapped[bool] = mapped_column(Boolean, default=False)
    matched_lists: Mapped[list[str]] = mapped_column(JSON, nullable=True)
    llm_called: Mapped[bool] = mapped_column(Boolean, default=False)
    llm_confidence: Mapped[float] = mapped_column(Float, nullable=True)
    llm_reasoning: Mapped[str] = mapped_column(Text, nullable=True)
    llm_is_genuine: Mapped[bool] = mapped_column(Boolean, nullable=True)
    result: Mapped[str] = mapped_column(String(30), default="pending")
    reviewed_by: Mapped[str] = mapped_column(String(36), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    review_outcome: Mapped[str] = mapped_column(String(30), nullable=True)
    review_notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
