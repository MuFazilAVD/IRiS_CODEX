from __future__ import annotations

from pydantic import BaseModel


class AdminCreateUserRequest(BaseModel):
    full_name: str
    email: str
    role: str


class AdminUpdateUserRequest(BaseModel):
    role: str | None = None
    status: str | None = None


class AdminWorkflowAgentUpdateRequest(BaseModel):
    enabled: bool | None = None
    confidence_threshold: float | None = None
    hitl_behavior: str | None = None
    escalation_rule: str | None = None
    retry_limit: int | None = None
    fallback_mode: str | None = None
