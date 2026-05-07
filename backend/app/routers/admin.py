from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models.user import User
from app.repositories.admin_repository import AdminRepository
from app.schemas.admin import AdminCreateUserRequest, AdminUpdateUserRequest
from app.services.admin_service import AdminService


router = APIRouter(prefix="/admin", tags=["admin"])


def get_service(db: Session) -> AdminService:
    return AdminService(AdminRepository(db))


@router.get("/users")
def list_users(
    _: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_users()


@router.post("/users", status_code=201)
def create_user(
    payload: AdminCreateUserRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).create_user(payload.full_name, payload.email, payload.role, current_user)


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    payload: AdminUpdateUserRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).update_user(user_id, payload.role, payload.status, current_user)


@router.delete("/users/{user_id}")
def revoke_user(
    user_id: str,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).revoke_user(user_id, current_user)


@router.get("/permissions")
def list_permissions(
    _: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_permissions()


@router.get("/approval-matrix")
def list_approval_matrix(
    _: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_approval_matrix()


@router.get("/audit-log")
def get_audit_log(
    _: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_audit_log()


@router.get("/integration-health")
def get_integration_health(
    _: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_integration_health()


@router.get("/pending-approvals")
def get_pending_approvals(
    _: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_pending_approvals()


@router.get("/library")
def list_library_items(
    type: str | None = None,
    _: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).list_library_items(type)


@router.get("/library/{ref_id}")
def get_library_item(
    ref_id: str,
    _: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).get_library_item(ref_id)


@router.post("/library", status_code=201)
async def upload_library_version(
    data_type: str = Form(...),
    source: str = Form(...),
    effective_date: str = Form(...),
    notes: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).upload_library_version(
        data_type,
        source,
        effective_date,
        file.filename if file else None,
        notes,
        current_user,
    )


@router.post("/library/screening-cache/{list_name}/sync")
def force_sync_screening_cache(
    list_name: str,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).force_sync_screening_cache(list_name, current_user)
