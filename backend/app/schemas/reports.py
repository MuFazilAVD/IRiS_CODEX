from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ReportsExportRequest(BaseModel):
    report_ids: list[str] = Field(default_factory=list)
    format: str
    filters: dict[str, Any] = Field(default_factory=dict)
