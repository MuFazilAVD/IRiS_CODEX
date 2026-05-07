from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import AuditExportReportDownloadRequest, AuditSearchRequest
from app.services.audit_service import AuditService


router = APIRouter(prefix="/audit", tags=["audit"])


def get_service(db: Session) -> AuditService:
    return AuditService(AuditRepository(db))


@router.get("/dashboard")
def get_dashboard(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_dashboard()


@router.get("/search")
def search_events(
    filters: AuditSearchRequest = Depends(),
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).search_events(filters)


@router.get("/financial-impact")
def get_financial_impact(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_financial_impact()


@router.get("/approvals")
def get_approvals(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_approvals()


@router.get("/ai-decisions")
def get_ai_decisions(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_ai_decisions()


@router.get("/manual-overrides")
def get_manual_overrides(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_manual_overrides()


@router.get("/reference-data")
def get_reference_data(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_reference_data()


@router.get("/access-logs")
def get_access_logs(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_access_logs()


@router.get("/document-history")
def get_document_history(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_document_history()


@router.get("/export-reports")
def get_export_reports(
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_export_reports()


@router.get("/export-reports/download")
def download_export_report(
    payload: AuditExportReportDownloadRequest = Depends(),
    _: User = Depends(require_roles(["compliance"])),
    db: Session = Depends(get_db),
) -> Response:
    report = get_service(db).download_export_report(payload.report_name, payload.format)
    return Response(
        content=report["content"],
        media_type=report["content_type"],
        headers={"Content-Disposition": f'attachment; filename="{report["filename"]}"'},
    )
