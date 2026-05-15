from __future__ import annotations

from typing import Any

from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Form, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models.user import User
from app.repositories.claims_repository import ClaimsRepository
from app.schemas.claims import (
    CalculationRunRequest,
    DetectPipelineRequest,
    ExceptionResolutionRequest,
    MapContractPipelineRequest,
    SettlementApproveRequest,
    SettlementDisputeRequest,
    SettlementHoldRequest,
)
from app.services.claims_service import ClaimsService


router = APIRouter(prefix="/claims", tags=["claims"])


def get_service(db: Session) -> ClaimsService:
    return ClaimsService(ClaimsRepository(db))


@router.get("/cession-files")
def list_cession_files(
    status: str = "all",
    file_type: str | None = None,
    cedent_id: str | None = None,
    page: int = 1,
    page_size: int = 20,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_cession_files(status, file_type, cedent_id, page, page_size)


@router.post("/cession-files/upload", status_code=201)
async def upload_cession_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    cedent_id: str | None = Form(default=None),
    contract_id: str | None = Form(default=None),
    file_type: str | None = Form(default=None),
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return await get_service(db).upload_cession_file(file, background_tasks, cedent_id, contract_id, file_type)


@router.get("/cession-files/testcases")
def list_cession_upload_testcases(
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_cession_upload_testcases()


@router.get("/cession-files/testcases/{filename}")
def download_cession_upload_testcase(
    filename: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> Response:
    testcase = get_service(db).download_cession_upload_testcase(filename)
    return Response(
        content=testcase["content"],
        media_type=testcase["content_type"],
        headers={"Content-Disposition": f'attachment; filename="{testcase["filename"]}"'},
    )


@router.get("/cession-files/{file_id}")
def get_cession_file_detail(
    file_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_cession_file_detail(file_id)


@router.post("/cession-files/{file_id}/pipeline/{stage}")
def advance_pipeline_stage(
    file_id: str,
    stage: str,
    payload: Any = Body(default={}),
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if stage == "detect":
        parsed_payload = DetectPipelineRequest.model_validate(payload)
        return get_service(db).advance_pipeline_stage(file_id, stage, parsed_payload.model_dump())
    if stage == "map-contract":
        parsed_payload = MapContractPipelineRequest.model_validate(payload)
        return get_service(db).advance_pipeline_stage(file_id, stage, parsed_payload.model_dump())
    if stage == "process-exceptions":
        parsed_payload = ExceptionResolutionRequest.model_validate(payload)
        return get_service(db).advance_pipeline_stage(file_id, stage, parsed_payload.model_dump())
    return get_service(db).advance_pipeline_stage(file_id, stage, payload if isinstance(payload, dict) else {})


@router.get("/cession-files/{file_id}/pipeline-status")
def get_pipeline_status(
    file_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_pipeline_status(file_id)


@router.get("/cession-files/{file_id}/summary")
def get_cession_file_summary(
    file_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_cession_file_summary(file_id)


@router.get("/cession-files/{file_id}/settlement-artifacts/{artifact_id}/download")
def download_settlement_pipeline_artifact(
    file_id: str,
    artifact_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> Response:
    artifact = get_service(db).download_settlement_pipeline_artifact(file_id, artifact_id)
    return Response(
        content=artifact["content"],
        media_type=artifact["content_type"],
        headers={"Content-Disposition": f'attachment; filename="{artifact["filename"]}"'},
    )


@router.get("/settlements")
def list_settlements(
    status: str = "all",
    contract_id: str | None = None,
    cedent_id: str | None = None,
    period: str | None = None,
    page: int = 1,
    page_size: int = 20,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_settlements(status, contract_id, cedent_id, period, page, page_size)


@router.get("/settlements/{settlement_id}")
def get_settlement_detail(
    settlement_id: str,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_settlement_detail(settlement_id)


@router.post("/settlements/{settlement_id}/approve")
def approve_settlement(
    settlement_id: str,
    payload: SettlementApproveRequest,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).approve_settlement(settlement_id, payload.notes)


@router.post("/settlements/{settlement_id}/dispute")
def dispute_settlement(
    settlement_id: str,
    payload: SettlementDisputeRequest,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).dispute_settlement(settlement_id, payload.reason)


@router.post("/settlements/{settlement_id}/hold")
def hold_settlement(
    settlement_id: str,
    payload: SettlementHoldRequest,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).hold_settlement(settlement_id, payload.reason)


@router.get("/calculations/contracts")
def list_calculation_contracts(
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    return get_service(db).list_calculation_contracts()


@router.post("/calculations/run")
def run_calculation(
    payload: CalculationRunRequest,
    _: User = Depends(require_roles(["claims_ops"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).run_calculation(payload.model_dump())
