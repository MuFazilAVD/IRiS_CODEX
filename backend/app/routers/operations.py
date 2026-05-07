from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models.user import User
from app.repositories.operations_repository import OperationsRepository
from app.schemas.operations import (
    PipelineAbortRequest,
    PipelineAdvanceRequest,
    PipelineScreeningResolveRequest,
)
from app.services.operations_service import OperationsService


router = APIRouter(prefix="/operations", tags=["operations"])


def get_service(db: Session) -> OperationsService:
    return OperationsService(OperationsRepository(db))


@router.get("/pipelines")
def list_pipelines(
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_pipelines()


@router.get("/pipelines/{process_id}")
def get_pipeline(
    process_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_pipeline(process_id)


@router.get("/pipelines/{process_id}/normalization")
def get_normalization(
    process_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_normalization(process_id)


@router.get("/pipelines/{process_id}/calculations")
def get_calculations(
    process_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_calculations(process_id)


@router.get("/pipelines/{process_id}/variance")
def get_variance(
    process_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_variance(process_id)


@router.get("/pipelines/{process_id}/screening")
def get_screening(
    process_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_screening(process_id)


@router.get("/pipelines/{process_id}/ai-decision")
def get_ai_decision(
    process_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_ai_decision(process_id)


@router.get("/pipelines/{process_id}/outcome")
def get_outcome(
    process_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_outcome(process_id)


@router.post("/pipelines/{process_id}/advance")
def advance_pipeline(
    process_id: str,
    payload: PipelineAdvanceRequest,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).advance_pipeline(process_id, payload.current_step, payload.action, payload.notes)


@router.post("/pipelines/{process_id}/abort")
def abort_pipeline(
    process_id: str,
    payload: PipelineAbortRequest,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).abort_pipeline(process_id, payload.reason)


@router.post("/pipelines/{process_id}/screening/resolve")
def resolve_screening_hit(
    process_id: str,
    payload: PipelineScreeningResolveRequest,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).resolve_screening_hit(process_id, payload.screening_ref, payload.action, payload.notes)
