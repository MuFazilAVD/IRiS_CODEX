from __future__ import annotations

from pydantic import BaseModel, Field


class AuditSearchRequest(BaseModel):
    q: str | None = None
    module: str = "all"
    actor: str = "all"
    approval: str = "all"
    impact: str = "any"
    risk: str = "all"
    from_date: str | None = None
    to_date: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=200)


class AuditExportReportDownloadRequest(BaseModel):
    report_name: str
    format: str
