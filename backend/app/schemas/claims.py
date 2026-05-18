from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class DetectPipelineRequest(BaseModel):
    override_file_type: str | None = None
    override_cedent_id: str | None = None


class MapContractPipelineRequest(BaseModel):
    override_contract_id: str | None = None


class ExceptionResolutionItem(BaseModel):
    exception_id: str
    resolution: str
    override_value: str | None = None


class ExceptionResolutionRequest(BaseModel):
    exception_resolutions: list[ExceptionResolutionItem]


class WorkflowAgentApproveRequest(BaseModel):
    notes: str | None = None


class SettlementApproveRequest(BaseModel):
    notes: str | None = None


class SettlementDisputeRequest(BaseModel):
    reason: str


class SettlementHoldRequest(BaseModel):
    reason: str | None = None


class CalculationRunRequest(BaseModel):
    contract_id: str
    calculation_type: str
    period_start: date
    period_end: date
