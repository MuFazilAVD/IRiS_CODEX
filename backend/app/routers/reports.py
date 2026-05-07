from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models.user import User
from app.repositories.reports_repository import ReportsRepository
from app.schemas.reports import ReportsExportRequest
from app.services.reports_service import ReportsService


router = APIRouter(prefix="/reports", tags=["reports"])


def get_service(db: Session) -> ReportsService:
    return ReportsService(ReportsRepository(db))


@router.get("")
def list_reports(
    category: str | None = Query(default=None),
    cedent_id: str | None = Query(default=None),
    contract_id: str | None = Query(default=None),
    period: str | None = Query(default=None),
    sensitivity: str | None = Query(default=None),
    current_user: User = Depends(require_roles(["admin", "underwriter", "claims_ops", "compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_reports(current_user.role, category, cedent_id, contract_id, period, sensitivity)


@router.get("/{report_id}")
def get_report_detail(
    report_id: str,
    current_user: User = Depends(require_roles(["admin", "underwriter", "claims_ops", "compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_report_detail(report_id, current_user.role)


@router.post("/export")
def export_reports(
    payload: ReportsExportRequest,
    current_user: User = Depends(require_roles(["admin", "underwriter", "claims_ops", "compliance"])),
    db: Session = Depends(get_db),
) -> Response:
    export_file = get_service(db).export_reports(payload.report_ids, payload.format, payload.filters, current_user.role)
    return Response(
        content=export_file["content"],
        media_type=export_file["content_type"],
        headers={"Content-Disposition": f'attachment; filename="{export_file["filename"]}"'},
    )
