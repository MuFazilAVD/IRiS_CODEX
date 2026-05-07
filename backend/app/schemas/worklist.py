from __future__ import annotations

from pydantic import BaseModel


class WorklistUpdateRequest(BaseModel):
    status: str | None = None
    assigned_to: str | None = None
    notes: str | None = None

