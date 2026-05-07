from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_request_role
from app.services.dashboard_service import DashboardService
from app.repositories.dashboard_repository import DashboardRepository


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def get_service() -> DashboardService:
    return DashboardService(DashboardRepository())


@router.get("/kpis")
def get_kpis(role: str = Depends(get_request_role)) -> dict:
    return get_service().get_kpis(role)


@router.get("/intelligence")
def get_intelligence(role: str = Depends(get_request_role)) -> dict:
    return get_service().get_intelligence(role)


@router.get("/graphs")
def get_graphs(role: str = Depends(get_request_role)) -> dict:
    return get_service().get_graphs(role)


@router.get("/recent-activities")
def get_recent_activities() -> dict:
    return get_service().get_recent_activities()

