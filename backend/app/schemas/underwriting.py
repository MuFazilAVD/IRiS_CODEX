from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class CedentCreateRequest(BaseModel):
    legal_entity_name: str
    country: str
    entity_type: str


class CedentStatusUpdateRequest(BaseModel):
    status: str
    reason: str


class ScreeningTriggerRequest(BaseModel):
    sources: list[str]


class ContractCreateRequest(BaseModel):
    contract_name: str
    cedent_id: str
    counterparty_role: str = "Reinsurer"
    parent_contract_id: str | None = None
    swap_type: str
    structure: str
    master_agreement_reference: str | None = None
    inception_date: str
    effective_date: str | None = None
    maturity_date: str
    duration_years: int | None = None
    governing_law: str | None = None
    jurisdiction: str | None = None
    notional_amount: float
    currency: str
    fixed_leg_rate_pct: float
    fixed_leg_frequency: str
    floating_leg_definition: str
    floating_leg_index_table: str | None = None


class ContractAmendmentRequest(BaseModel):
    description: str
    changed_sections: list[str]
    changes: dict[str, Any] = {}
    amendment_type: str = "Other"
    submitted_date: str
    effective_date: str
    status: str = "pending_approval"


class GenericSectionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    def as_payload(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)
