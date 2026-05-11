from __future__ import annotations

from pydantic import BaseModel, Field


class SanctionsScreenRequest(BaseModel):
    screening_ref: str | None = None
    entity_name: str
    dob: str | None = None
    cedent_id: str | None = None
    member_id: str | None = None
    trigger_type: str | None = None
    cession_file_id: str | None = None
    country: str | None = None
    registration_number: str | None = None
    aliases: str | None = None
    registered_address: str | None = None
    beneficial_owners: str | None = None
    bank_details: str | None = None
    sources: list[str] | None = None
    persist_case: bool = False


class BulkScreeningTriggerRequest(BaseModel):
    sources: list[str] = Field(default_factory=list)
    scope: str = "all_active"


class SanctionsHitResolutionRequest(BaseModel):
    action: str
    notes: str | None = None


class ScreeningCacheWorkbookEntryRequest(BaseModel):
    entity_name: str = ""
    aliases: list[str] = Field(default_factory=list)
    list_identifier: str = ""
    entity_type: str = ""
    country: str = ""
    street_address: str = ""
    city: str = ""
    postal_code: str = ""
    tax_identification_number: str | None = None
    company_registration_number: str | None = None
    dob: str | None = None


class ScreeningCacheWorkbookUpdateRequest(BaseModel):
    entries: list[ScreeningCacheWorkbookEntryRequest] = Field(default_factory=list)
