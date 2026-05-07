from __future__ import annotations

from pydantic import BaseModel, Field


class SanctionsScreenRequest(BaseModel):
    entity_name: str
    dob: str | None = None
    cedent_id: str | None = None
    member_id: str | None = None
    trigger_type: str | None = None
    cession_file_id: str | None = None


class BulkScreeningTriggerRequest(BaseModel):
    sources: list[str] = Field(default_factory=list)
    scope: str = "all_active"


class SanctionsHitResolutionRequest(BaseModel):
    action: str
    notes: str | None = None
