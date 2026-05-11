from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models.user import User
from app.repositories.compliance_repository import ComplianceRepository
from app.schemas.compliance import (
    BulkScreeningTriggerRequest,
    SanctionsHitResolutionRequest,
    SanctionsScreenRequest,
    ScreeningCacheWorkbookUpdateRequest,
)
from app.services.compliance_service import ComplianceService


router = APIRouter(prefix="/compliance", tags=["compliance"])


def get_service(db: Session) -> ComplianceService:
    return ComplianceService(ComplianceRepository(db))


@router.get("/sanctions/overview")
def get_sanctions_overview(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_sanctions_overview()


@router.get("/sanctions/screen")
def screen_entity(
    payload: SanctionsScreenRequest = Depends(),
    current_user: User = Depends(require_roles(["claims_ops", "compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).screen_entity(
        payload.screening_ref,
        payload.entity_name,
        payload.dob,
        payload.cedent_id,
        payload.member_id,
        payload.trigger_type,
        payload.cession_file_id,
        payload.country,
        payload.registration_number,
        payload.aliases,
        payload.registered_address,
        payload.beneficial_owners,
        payload.bank_details,
        payload.sources,
        payload.persist_case,
        current_user,
    )


@router.get("/sanctions/hits/{screening_ref}")
def get_screening_case(
    screening_ref: str,
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_screening_case(screening_ref)


@router.get("/sanctions/cedents/{cedent_id}")
def get_cedent_screening(
    cedent_id: str,
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_cedent_screening(cedent_id)


@router.post("/sanctions/trigger")
def trigger_bulk_screening(
    payload: BulkScreeningTriggerRequest,
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).trigger_bulk_screening(payload.sources, payload.scope)


@router.post("/sanctions/bulk-screen", status_code=202)
def queue_bulk_screening(
    payload: BulkScreeningTriggerRequest,
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).queue_bulk_screening(payload.sources, payload.scope)


@router.get("/sanctions/hits")
def list_active_hits(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_active_hits()


@router.get("/sanctions/cache-workbooks")
def get_cache_workbooks(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_screening_cache_workbooks()


@router.get("/sanctions/cache-workbooks/{list_name}/download")
def download_cache_workbook(
    list_name: str,
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> Response:
    workbook = get_service(db).download_screening_cache_workbook(list_name)
    return Response(
        content=workbook["content"],
        media_type=workbook["content_type"],
        headers={"Content-Disposition": f'attachment; filename="{workbook["filename"]}"'},
    )


@router.patch("/sanctions/cache-workbooks/{list_name}")
def update_cache_workbook(
    list_name: str,
    payload: ScreeningCacheWorkbookUpdateRequest,
    current_user: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).update_screening_cache_workbook(list_name, [entry.model_dump() for entry in payload.entries], current_user)


@router.patch("/sanctions/hits/{screening_ref}")
def resolve_hit(
    screening_ref: str,
    payload: SanctionsHitResolutionRequest,
    current_user: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).resolve_hit(screening_ref, payload.action, payload.notes, current_user)
