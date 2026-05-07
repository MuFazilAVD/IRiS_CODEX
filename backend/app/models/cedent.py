from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Cedent(Base):
    __tablename__ = "cedents"

    cedent_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    legal_entity_name: Mapped[str] = mapped_column(String(300), nullable=False)
    trading_name: Mapped[str] = mapped_column(String(300), nullable=True)
    registered_company_number: Mapped[str] = mapped_column(String(100), nullable=True)
    tax_identification_number: Mapped[str] = mapped_column(String(100), nullable=True)
    lei: Mapped[str] = mapped_column(String(20), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=True)
    jurisdiction: Mapped[str] = mapped_column(String(100), nullable=True)
    country_of_registration: Mapped[str] = mapped_column(String(10), nullable=True)
    date_of_incorporation: Mapped[date] = mapped_column(Date, nullable=True)
    regulatory_status: Mapped[str] = mapped_column(String(100), nullable=True)
    ownership_structure: Mapped[str] = mapped_column(String(200), nullable=True)
    parent_company: Mapped[str] = mapped_column(String(200), nullable=True)
    group_structure: Mapped[str] = mapped_column(Text, nullable=True)
    aum_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    aum_currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="onboarding")
    screening_status: Mapped[str] = mapped_column(String(50), default="pending")
    onboarded_date: Mapped[date] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
