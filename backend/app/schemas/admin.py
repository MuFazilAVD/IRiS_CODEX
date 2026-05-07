from __future__ import annotations

from pydantic import BaseModel


class AdminCreateUserRequest(BaseModel):
    full_name: str
    email: str
    role: str


class AdminUpdateUserRequest(BaseModel):
    role: str | None = None
    status: str | None = None

