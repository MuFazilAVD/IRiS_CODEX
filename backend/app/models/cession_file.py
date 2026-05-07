import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CessionFile(Base):
    __tablename__ = "cession_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.contract_id"), nullable=True)
    cedent_id: Mapped[str] = mapped_column(ForeignKey("cedents.cedent_id"), nullable=True)
    filename: Mapped[str] = mapped_column(String(300), nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=True)
    record_count: Mapped[int] = mapped_column(Integer, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    received_via: Mapped[str] = mapped_column(String(50), nullable=True)
    stage: Mapped[str] = mapped_column(String(50), default="uploaded")
    ai_file_type_confidence: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    ai_cedent_confidence: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, default=0)
    sla_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
