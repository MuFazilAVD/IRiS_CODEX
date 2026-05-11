from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models.user import User
from app.repositories.underwriting_repository import UnderwritingRepository
from app.schemas.underwriting import (
    CedentCreateRequest,
    CedentStatusUpdateRequest,
    ContractAmendmentRequest,
    ContractCreateRequest,
    ScreeningTriggerRequest,
)
from app.services.underwriting_service import UnderwritingService


router = APIRouter(prefix="/underwriting", tags=["underwriting"])


def get_service(db: Session) -> UnderwritingService:
    return UnderwritingService(UnderwritingRepository(db))


@router.get("/cedents")
def list_cedents(
    search: str | None = None,
    status: str = "all",
    page: int = 1,
    page_size: int = 20,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_cedents(search, status, page, page_size)


@router.get("/cedents/{cedent_id}")
def get_cedent_detail(
    cedent_id: str,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_cedent_detail(cedent_id)


@router.post("/cedents", status_code=201)
def create_cedent(
    payload: CedentCreateRequest,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).create_cedent(payload.model_dump())


@router.patch("/cedents/{cedent_id}/{section}")
def update_cedent_section(
    cedent_id: str,
    section: str,
    payload: Any = Body(...),
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).update_section(cedent_id, section, payload)


@router.post("/cedents/ai-extract")
async def ai_extract(
    file: UploadFile = File(...),
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return await get_service(db).ai_extract(file)


@router.post("/cedents/{cedent_id}/sanction-screening")
def trigger_sanction_screening(
    cedent_id: str,
    payload: ScreeningTriggerRequest,
    current_user: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).trigger_sanction_screening(cedent_id, payload.sources, current_user)


@router.get("/cedents/{cedent_id}/sanction-screening/history")
def get_sanction_screening_history(
    cedent_id: str,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_sanction_screening_history(cedent_id)


@router.patch("/cedents/{cedent_id}/status")
def update_cedent_status(
    cedent_id: str,
    payload: CedentStatusUpdateRequest,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).update_status(cedent_id, payload.status, payload.reason)


@router.get("/contracts")
def list_contracts(
    cedent_id: str | None = None,
    search: str | None = None,
    status: str = "all",
    page: int = 1,
    page_size: int = 20,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_contracts(cedent_id, search, status, page, page_size)


@router.get("/contracts/{contract_id}")
def get_contract_detail(
    contract_id: str,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_contract_detail(contract_id)


@router.post("/contracts", status_code=201)
def create_contract(
    payload: ContractCreateRequest,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).create_contract(payload.model_dump())


@router.patch("/contracts/{contract_id}/{section}")
def update_contract_section(
    contract_id: str,
    section: str,
    payload: Any = Body(...),
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).update_contract_section(contract_id, section, payload)


@router.post("/contracts/{contract_id}/amend")
def create_contract_amendment(
    contract_id: str,
    payload: ContractAmendmentRequest,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).create_contract_amendment(contract_id, payload.model_dump())


@router.get("/contracts/{contract_id}/details-performance")
def get_contract_details_performance(
    contract_id: str,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_contract_details_performance(contract_id)


@router.get("/contracts/{contract_id}/calculations")
def get_contract_calculations(
    contract_id: str,
    metric: str = "settlement_variance",
    aggregation: str = "sum",
    group_by: str = "per_quarter",
    from_period: str = Query("Q1 2024", alias="from"),
    to_period: str = Query("Q1 2025", alias="to"),
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_contract_calculations(contract_id, metric, aggregation, group_by, from_period, to_period)


@router.get("/contracts/{contract_id}/member-list")
def get_contract_member_list(
    contract_id: str,
    status: str = "all",
    page: int = 1,
    page_size: int = 50,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_contract_member_list(contract_id, status, page, page_size)


@router.post("/contracts/{contract_id}/upload-members")
async def upload_contract_members(
    contract_id: str,
    file: UploadFile = File(...),
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return await get_service(db).upload_contract_members(contract_id, file)


@router.get("/population")
def list_population(
    cedent_id: str | None = None,
    contract_id: str | None = None,
    status: str = "all",
    page: int = 1,
    page_size: int = 50,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_population(cedent_id, contract_id, status, page, page_size)


@router.get("/population/{member_id}/history")
def get_population_history(
    member_id: str,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_population_history(member_id)


@router.patch("/population/{member_id}/defer")
def defer_population_member(
    member_id: str,
    _: User = Depends(require_roles(["underwriter"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).defer_population_member(member_id)
