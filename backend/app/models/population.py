import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PolicyRegister(Base):
    __tablename__ = "policy_register"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.contract_id"), nullable=False)
    member_id: Mapped[str] = mapped_column(String(50), nullable=False)
    policy_id: Mapped[str] = mapped_column(String(50), nullable=True)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String(1), nullable=False)
    smoker_status: Mapped[str] = mapped_column(String(20), nullable=True)
    postcode: Mapped[str] = mapped_column(String(20), nullable=True)
    annual_pension: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    pension_currency: Mapped[str] = mapped_column(String(10), default="GBP", nullable=True)
    escalation_type: Mapped[str] = mapped_column(String(50), nullable=True)
    escalation_rate: Mapped[float] = mapped_column(Numeric(5, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active")
    date_of_death: Mapped[date] = mapped_column(Date, nullable=True)
    commencement_date: Mapped[date] = mapped_column(Date, nullable=True)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date] = mapped_column(Date, nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    source_cession_file_id: Mapped[str] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
