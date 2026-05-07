from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Contract(Base):
    __tablename__ = "contracts"

    contract_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    contract_name: Mapped[str] = mapped_column(String(300), nullable=False)
    contract_version: Mapped[str] = mapped_column(String(20), default="v1.0")
    cedent_id: Mapped[str] = mapped_column(ForeignKey("cedents.cedent_id"), nullable=True)
    counterparty_role: Mapped[str] = mapped_column(String(50), default="Reinsurer", nullable=True)
    swap_type: Mapped[str] = mapped_column(String(100), nullable=True)
    structure: Mapped[str] = mapped_column(String(100), nullable=True)
    master_agreement_ref: Mapped[str] = mapped_column(String(100), nullable=True)
    inception_date: Mapped[date] = mapped_column(Date, nullable=True)
    effective_date: Mapped[date] = mapped_column(Date, nullable=True)
    maturity_date: Mapped[date] = mapped_column(Date, nullable=True)
    duration_years: Mapped[int] = mapped_column(Integer, nullable=True)
    governing_law: Mapped[str] = mapped_column(String(100), nullable=True)
    jurisdiction: Mapped[str] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    notional_amount: Mapped[float] = mapped_column(Numeric(20, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=True)
    fixed_leg_rate: Mapped[float] = mapped_column(Numeric(8, 6), nullable=True)
    fixed_leg_frequency: Mapped[str] = mapped_column(String(50), nullable=True)
    floating_leg_definition: Mapped[str] = mapped_column(String(200), nullable=True)
    floating_leg_index: Mapped[str] = mapped_column(String(200), nullable=True)
    lives_count: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
