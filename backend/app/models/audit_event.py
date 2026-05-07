import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    audit_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(200), nullable=True)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    financial_impact_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=True)
    financial_impact_currency: Mapped[str] = mapped_column(String(10), nullable=True)
    is_high_impact: Mapped[bool] = mapped_column(Boolean, default=False)
    approval_status: Mapped[str] = mapped_column(String(20), default="n/a")
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    contract_id: Mapped[str] = mapped_column(String(30), nullable=True)
    cedent_id: Mapped[str] = mapped_column(String(20), nullable=True)
    cession_file_id: Mapped[str] = mapped_column(String(36), nullable=True)
    settlement_id: Mapped[str] = mapped_column(String(30), nullable=True)
    ip_address: Mapped[str] = mapped_column(String(50), nullable=True)
    session_id: Mapped[str] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
