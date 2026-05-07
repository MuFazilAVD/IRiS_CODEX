import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    settlement_id: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.contract_id"), nullable=True)
    cedent_id: Mapped[str] = mapped_column(String(20), nullable=True)
    cession_file_id: Mapped[str] = mapped_column(ForeignKey("cession_files.id"), nullable=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    period_label: Mapped[str] = mapped_column(String(50), nullable=True)
    fixed_leg_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    floating_leg_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    net_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=True)
    direction: Mapped[str] = mapped_column(String(30), nullable=True)
    payment_due_date: Mapped[date] = mapped_column(Date, nullable=True)
    payment_date: Mapped[date] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending_approval")
    cedant_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    reinsurer_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_by: Mapped[str] = mapped_column(String(36), nullable=True)
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
