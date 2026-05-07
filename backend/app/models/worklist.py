import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WorklistItem(Base):
    __tablename__ = "worklist_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wl_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(50), default="open")
    assigned_role: Mapped[str] = mapped_column(String(50), nullable=True)
    assigned_to: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=True)
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.contract_id"), nullable=True)
    cedent_id: Mapped[str] = mapped_column(ForeignKey("cedents.cedent_id"), nullable=True)
    cession_file_id: Mapped[str] = mapped_column(ForeignKey("cession_files.id"), nullable=True)
    settlement_id: Mapped[str] = mapped_column(String(30), nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=True)
    source_detail: Mapped[str] = mapped_column(String(200), nullable=True)
    sla_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    elapsed_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    compliance_hold: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    breadcrumb: Mapped[str] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
