from __future__ import annotations

from pydantic import BaseModel


class PipelineAdvanceRequest(BaseModel):
    current_step: str
    action: str = "approve"
    notes: str | None = None


class PipelineAbortRequest(BaseModel):
    reason: str | None = None


class PipelineScreeningResolveRequest(BaseModel):
    screening_ref: str
    action: str
    notes: str | None = None
