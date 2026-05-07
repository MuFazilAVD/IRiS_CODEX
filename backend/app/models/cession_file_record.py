import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CessionFileRecord(Base):
    __tablename__ = "cession_file_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cession_file_id: Mapped[str] = mapped_column(ForeignKey("cession_files.id"), nullable=False)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    member_id: Mapped[str] = mapped_column(String(50), nullable=True)
    raw_data: Mapped[str] = mapped_column(Text, nullable=True)
    mapped_data: Mapped[str] = mapped_column(Text, nullable=True)
    validation_status: Mapped[str] = mapped_column(String(50), nullable=True)
    validation_issues: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
