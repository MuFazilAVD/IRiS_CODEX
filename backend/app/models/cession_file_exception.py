import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CessionFileException(Base):
    __tablename__ = "cession_file_exceptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cession_file_id: Mapped[str] = mapped_column(ForeignKey("cession_files.id"), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    issue_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    current_value: Mapped[str] = mapped_column(String(500), nullable=True)
    ai_suggestion: Mapped[str] = mapped_column(String(500), nullable=True)
    ai_confidence: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    resolution: Mapped[str] = mapped_column(String(50), default="pending", nullable=True)
    resolved_by: Mapped[str] = mapped_column(String(36), nullable=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
