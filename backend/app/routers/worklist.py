from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_request_role
from app.repositories.worklist_repository import WorklistRepository
from app.schemas.worklist import WorklistUpdateRequest
from app.services.worklist_service import WorklistService


router = APIRouter(prefix="/worklist", tags=["worklist"])


def get_service(db: Session) -> WorklistService:
    return WorklistService(WorklistRepository(db))


@router.get("")
def get_worklist(
    role: str = Depends(get_request_role),
    db: Session = Depends(get_db),
) -> dict:
    return get_service(db).get_worklist(role)


@router.patch("/{wl_id}")
def update_worklist_item(
    wl_id: str,
    payload: WorklistUpdateRequest,
    role: str = Depends(get_request_role),
    db: Session = Depends(get_db),
) -> dict:
    return get_service(db).update_worklist_item(role, wl_id, payload.status, payload.assigned_to)

