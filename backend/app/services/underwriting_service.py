from __future__ import annotations

import json
import logging
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from fastapi import UploadFile

from app.errors import IrisAPIError
from app.models.audit_event import AuditEvent
from app.models.cedent import Cedent
from app.models.contract import Contract
from app.models.population import PolicyRegister
from app.models.user import User
from app.models.worklist import WorklistItem
from app.repositories.underwriting_repository import UnderwritingRepository
from app.services.population_csv import PopulationCsvNormalizedRow, parse_population_file


logger = logging.getLogger(__name__)
UTC = timezone.utc

SECTION_NAME_MAP = {
    "legal-entity": "legal_entity",
    "pension-scheme": "pension_scheme",
    "key-contacts": "key_contacts",
    "financial-treasury": "financial_treasury",
    "contract-readiness": "contract_readiness",
    "population-exposure": "population_exposure",
    "compliance-kyc": "compliance_kyc",
    "regulatory-docs": "regulatory_docs",
    "operational-connectivity": "operational_connectivity",
    "actuarial-preferences": "actuarial_preferences",
    "access-beneficiary-rules": "access_beneficiary_rules",
    "audit-approval": "audit_approval",
}

DETAIL_OVERRIDES_FILE = Path(__file__).resolve().parent.parent / "mock_data" / "cedent_detail_overrides.json"
POPULATION_SEED_FILE = Path(__file__).resolve().parent.parent / "mock_data" / "population_seed.json"
POPULATION_OVERRIDES_FILE = Path(__file__).resolve().parent.parent / "mock_data" / "population_overrides.json"
CONTRACT_SECTION_NAME_MAP = {
    "master-data": "master_data",
    "economic-terms": "economic_terms",
    "reference-pool": "reference_pool",
    "actuarial-basis": "actuarial_basis",
    "risk-limits": "risk_limits",
    "operational-terms": "operational_terms",
    "compliance-docs": "compliance_docs",
}
CONTRACT_DETAIL_OVERRIDES_FILE = Path(__file__).resolve().parent.parent / "mock_data" / "contract_detail_overrides.json"
# Temporary backfill defaults keep early-phase population uploads moving until richer member enrichment lands.
RELAXED_POPULATION_UPLOAD_PLACEHOLDER_DOB = date(1900, 1, 1)
RELAXED_POPULATION_UPLOAD_PLACEHOLDER_PENSION = Decimal("0")


class UnderwritingService:
    def __init__(self, repository: UnderwritingRepository) -> None:
        self.repository = repository

    def list_cedents(self, search: str | None, status: str | None, page: int, page_size: int) -> dict[str, Any]:
        logger.info("Loading cedants list")
        logger.debug(
            "Cedants list search=%s status=%s page=%s page_size=%s",
            search,
            status,
            page,
            page_size,
        )
        cedents, total = self.repository.list_cedents(search, status, page, page_size)
        items = [self._serialize_cedent_list_item(cedent) for cedent in cedents]
        for item in items:
            item["contracts_count"] = self._contracts_count(item["cedent_id"])
        return {"total": total, "page": page, "page_size": page_size, "items": items}

    def get_cedent_detail(self, cedent_id: str) -> dict[str, Any]:
        logger.info("Loading cedant detail")
        logger.debug("Cedant detail cedent_id=%s", cedent_id)
        cedent = self.repository.get_cedent(cedent_id)
        if cedent is None:
            logger.error("Cedant detail not found for cedent_id=%s", cedent_id)
            raise IrisAPIError(404, "Cedant not found", f"{cedent_id} does not exist")

        contracts = self.repository.list_contracts_for_cedent(cedent_id)
        detail = self._build_cedent_payload(cedent, contracts)
        return detail

    def create_cedent(self, payload: dict[str, Any]) -> dict[str, Any]:
        logger.info("Creating new cedant")
        logger.debug("Cedant create payload=%s", payload)
        cedent_id = self.repository.get_next_cedent_id()
        cedent = Cedent(
            cedent_id=cedent_id,
            legal_entity_name=payload["legal_entity_name"],
            entity_type=payload["entity_type"],
            country_of_registration=payload["country"],
            jurisdiction=payload["country"],
            status="onboarding",
            screening_status="pending",
            aum_currency="USD",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        created = self.repository.create_cedent(cedent)

        store = self._read_detail_store()
        store[cedent_id] = self._default_detail_store(created, [])
        self._write_detail_store(store)

        worklist_item = WorklistItem(
            wl_id=self.repository.get_next_worklist_id(),
            title=f"Cedant onboarding approval - {created.legal_entity_name}",
            description="New cedant onboarding submission requires approval review.",
            category="Override Approval",
            priority="high",
            status="pending_review",
            assigned_role="admin",
            cedent_id=created.cedent_id,
            source="Human",
            source_detail="New Cedant Wizard",
            breadcrumb="Cedant Onboarding - Approval Required",
        )
        self.repository.create_worklist_item(worklist_item)

        return {"cedent_id": created.cedent_id, "status": created.status}

    def update_section(self, cedent_id: str, section: str, payload: Any) -> dict[str, Any]:
        logger.info("Updating cedant section")
        logger.debug("Cedant section update cedent_id=%s section=%s payload=%s", cedent_id, section, payload)
        cedent = self.repository.get_cedent(cedent_id)
        if cedent is None:
            logger.error("Cedant section update failed for missing cedent_id=%s", cedent_id)
            raise IrisAPIError(404, "Cedant not found", f"{cedent_id} does not exist")

        if section not in SECTION_NAME_MAP:
            logger.error("Cedant section update failed for unsupported section=%s", section)
            raise IrisAPIError(400, "Invalid section", f"{section} is not supported")

        response_section = SECTION_NAME_MAP[section]
        if response_section == "legal_entity":
            updated = self._update_legal_entity(cedent, payload if isinstance(payload, dict) else {})
            return {"section": response_section, "data": updated}

        store = self._read_detail_store()
        current = self._build_cedent_payload(cedent, self.repository.list_contracts_for_cedent(cedent_id))
        merged = deepcopy(current[response_section])
        merged = self._deep_merge(merged, payload)
        store.setdefault(cedent_id, {})[response_section] = merged
        self._append_audit_event(
            store,
            cedent_id,
            {
                "timestamp": datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"),
                "actor": "Underwriter",
                "action": f"Updated {response_section.replace('_', ' ')} section",
                "detail": "User-saved section change",
            },
        )
        self._write_detail_store(store)
        return {"section": response_section, "data": merged}

    async def ai_extract(self, file: UploadFile) -> dict[str, Any]:
        logger.info("Running cedant AI extract")
        logger.debug("Cedant AI extract filename=%s", file.filename)

        # MOCK IMPLEMENTATION
        raw_bytes = await file.read()
        filename = (file.filename or "").lower()
        content = raw_bytes.decode("utf-8", errors="ignore").lower()
        is_northstar = "northstar" in filename or "northstar" in content

        if is_northstar:
            return {
                "extracted_fields": {
                    "legal_entity_name": {
                        "value": "Northstar Pension Trust",
                        "confidence": 0.98,
                        "citation": "Page 1, header",
                    },
                    "lei": {
                        "value": "5299001042ABCD1234EF56",
                        "confidence": 0.95,
                        "citation": "Section 2.1",
                    },
                    "country": {
                        "value": "UK",
                        "confidence": 0.99,
                        "citation": "Page 1",
                    },
                    "scheme_name": {
                        "value": "Northstar Pension Trust Defined Benefit Scheme",
                        "confidence": 0.91,
                        "citation": "Scheme summary",
                    },
                    "trustee_name": {
                        "value": "Northstar Pension Trust Trustee",
                        "confidence": 0.89,
                        "citation": "Trustee details",
                    },
                    "contact_name": {
                        "value": "Alex Morgan",
                        "confidence": 0.82,
                        "citation": "Contacts appendix",
                    },
                },
                "sections_populated": ["legal_entity", "pension_scheme", "key_contacts"],
                "low_confidence_fields": ["tax_identification_number", "contact_name"],
            }

        return {
            "extracted_fields": {
                "legal_entity_name": {
                    "value": "Acme Pension Fund",
                    "confidence": 0.74,
                    "citation": "Uploaded sample",
                },
                "country": {"value": "UK", "confidence": 0.81, "citation": "Uploaded sample"},
                "entity_type": {"value": "Pension Trust", "confidence": 0.79, "citation": "Uploaded sample"},
            },
            "sections_populated": ["legal_entity"],
            "low_confidence_fields": ["lei", "tax_identification_number"],
        }

    def trigger_sanction_screening(self, cedent_id: str, sources: list[str], actor: User) -> dict[str, Any]:
        logger.info("Triggering cedant sanctions screening")
        logger.debug("Sanctions screening cedent_id=%s sources=%s actor=%s", cedent_id, sources, actor.email)
        cedent = self.repository.get_cedent(cedent_id)
        if cedent is None:
            logger.error("Sanctions screening failed for missing cedent_id=%s", cedent_id)
            raise IrisAPIError(404, "Cedant not found", f"{cedent_id} does not exist")

        from app.repositories.compliance_repository import ComplianceRepository
        from app.services.compliance_service import ComplianceService

        normalized_sources = self._normalize_cedent_screening_sources(sources)
        compliance_service = ComplianceService(ComplianceRepository(self.repository.db))
        screening_result = compliance_service.screen_entity(
            screening_ref=None,
            entity_name=cedent.legal_entity_name,
            dob=None,
            cedent_id=cedent.cedent_id,
            member_id=None,
            trigger_type="onboarding" if cedent.status == "onboarding" else "adhoc",
            cession_file_id=None,
            country=cedent.country_of_registration,
            registration_number=cedent.registered_company_number,
            aliases=", ".join([value for value in [cedent.trading_name] if value]),
            registered_address=None,
            beneficial_owners=None,
            bank_details=None,
            sources=normalized_sources,
            persist_case=True,
            actor=actor,
        )

        store = self._read_detail_store()
        payload = self._build_cedent_payload(cedent, self.repository.list_contracts_for_cedent(cedent_id))
        screening = deepcopy(payload["sanction_screening"])
        now = datetime.now(UTC)
        screening_ref = str(screening_result["screening_ref"])
        matched_source_labels = {
            self._cedent_screening_source_label(item)
            for item in screening_result.get("matched_lists", [])
        }
        result = str(screening_result.get("result") or "cleared")
        any_match = result == "review"

        for source in normalized_sources:
            source_label = self._cedent_screening_source_label(source)
            source_matched = source_label in matched_source_labels
            row_result = "Pending Review" if any_match and source_matched else "Cleared"
            matches = 1 if source_matched else 0
            notes = (
                str(screening_result.get("llm_reasoning") or "Potential watchlist match found; waiting for compliance approval.")
                if source_matched
                else "No potential matches found"
            )

            screening["history"].insert(
                0,
                {
                    "id": f"{screening_ref}-{source_label}",
                    "screening_date": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": source_label,
                    "scan_type": "Adhoc",
                    "result": row_result,
                    "reference_id": screening_ref,
                    "matches": matches,
                    "reviewer": actor.email,
                    "notes": notes,
                },
            )
            existing = next((item for item in screening["source_status"] if self._cedent_screening_source_label(item["source"]) == source_label), None)
            updated_source = {
                "source": source_label,
                "status": "Pending Review" if source_matched else "Cleared",
                "last_scan": now.strftime("%Y-%m-%d"),
                "reference": screening_ref,
                "matches": matches,
            }
            if existing:
                screening["source_status"] = [
                    updated_source if self._cedent_screening_source_label(item["source"]) == source_label else item for item in screening["source_status"]
                ]
            else:
                screening["source_status"].append(updated_source)

        screening["total_scans"] = len(screening["history"])
        screening["open_hits"] = sum(1 for item in screening["history"] if item["matches"] > 0)
        screening["sources_monitored"] = len(screening["source_status"])

        cedent.screening_status = "pending" if any_match else "cleared"
        cedent.updated_at = datetime.utcnow()
        self.repository.update_cedent(cedent)
        store.setdefault(cedent_id, {})["sanction_screening"] = screening
        self._append_audit_event(
            store,
            cedent_id,
            {
                "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
                "actor": "IRiS Screening Engine",
                "action": "Triggered sanction screening",
                "detail": f"{', '.join(normalized_sources)} - {screening_ref} - {'pending review' if any_match else 'cleared'}",
            },
        )
        self._write_detail_store(store)

        return {
            "screening_id": screening_ref,
            "status": "pending_review" if any_match else "cleared",
            "estimated_completion_seconds": 0,
            "matched_lists": screening_result.get("matched_lists", []),
            "result": result,
        }

    def get_sanction_screening_history(self, cedent_id: str) -> dict[str, Any]:
        logger.info("Loading cedant sanction screening history")
        logger.debug("Sanctions history cedent_id=%s", cedent_id)
        cedent = self.repository.get_cedent(cedent_id)
        if cedent is None:
            logger.error("Sanctions history failed for missing cedent_id=%s", cedent_id)
            raise IrisAPIError(404, "Cedant not found", f"{cedent_id} does not exist")

        screening = self._build_cedent_payload(
            cedent,
            self.repository.list_contracts_for_cedent(cedent_id),
        )["sanction_screening"]
        return {
            "total_scans": screening["total_scans"],
            "open_hits": screening["open_hits"],
            "sources_monitored": screening["sources_monitored"],
            "next_periodic_due": screening["next_periodic_due"],
            "history": screening["history"],
        }

    def _normalize_cedent_screening_sources(self, sources: list[str]) -> list[str]:
        normalized: list[str] = []
        for source in sources or ["OFAC", "FinCEN"]:
            label = self._cedent_screening_source_label(source)
            if label not in normalized:
                normalized.append(label)
        return normalized or ["OFAC", "FinCEN"]

    def _cedent_screening_source_label(self, value: str) -> str:
        normalized = (value or "").strip().lower()
        if normalized.startswith("ofac"):
            return "OFAC"
        if normalized.startswith("fincen"):
            return "FinCEN"
        return value

    def update_status(self, cedent_id: str, status: str, reason: str) -> dict[str, Any]:
        logger.info("Updating cedant status")
        logger.debug("Cedant status update cedent_id=%s status=%s reason=%s", cedent_id, status, reason)
        cedent = self.repository.get_cedent(cedent_id)
        if cedent is None:
            logger.error("Cedant status update failed for missing cedent_id=%s", cedent_id)
            raise IrisAPIError(404, "Cedant not found", f"{cedent_id} does not exist")

        cedent.status = status
        cedent.is_active = status != "inactive"
        cedent.updated_at = datetime.utcnow()
        updated = self.repository.update_cedent(cedent)

        worklist_item_id = None
        if status == "active" and reason:
            worklist_item = WorklistItem(
                wl_id=self.repository.get_next_worklist_id(),
                title=f"Status change review - {updated.legal_entity_name}",
                description=reason,
                category="Override Approval",
                priority="medium",
                status="pending_review",
                assigned_role="compliance",
                cedent_id=updated.cedent_id,
                source="Human",
                source_detail="Cedant status update",
                breadcrumb="Cedant Status - Compliance Review",
            )
            self.repository.create_worklist_item(worklist_item)
            worklist_item_id = worklist_item.wl_id

        store = self._read_detail_store()
        self._append_audit_event(
            store,
            cedent_id,
            {
                "timestamp": datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"),
                "actor": "Underwriter",
                "action": f"Changed status to {status}",
                "detail": reason,
            },
        )
        self._write_detail_store(store)

        return {"cedent_id": updated.cedent_id, "status": updated.status, "worklist_item": worklist_item_id}

    def list_contracts(
        self,
        cedent_id: str | None,
        search: str | None,
        status: str | None,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        logger.info("Loading contracts list")
        logger.debug(
            "Contracts list cedent_id=%s search=%s status=%s page=%s page_size=%s",
            cedent_id,
            search,
            status,
            page,
            page_size,
        )
        contracts, total = self.repository.list_contracts(cedent_id, search, status, page, page_size)
        items = [self._serialize_contract_list_item(contract) for contract in contracts]
        return {"total": total, "page": page, "page_size": page_size, "items": items}

    def get_contract_detail(self, contract_id: str) -> dict[str, Any]:
        logger.info("Loading contract detail")
        logger.debug("Contract detail contract_id=%s", contract_id)
        contract = self.repository.get_contract(contract_id)
        if contract is None:
            logger.error("Contract detail not found for contract_id=%s", contract_id)
            raise IrisAPIError(404, "Contract not found", f"{contract_id} does not exist")

        return self._build_contract_payload(contract)

    def create_contract(self, payload: dict[str, Any]) -> dict[str, Any]:
        logger.info("Creating new contract")
        logger.debug("Contract create payload=%s", payload)
        cedent = self.repository.get_cedent(payload["cedent_id"])
        if cedent is None:
            logger.error("Contract creation failed for missing cedent_id=%s", payload["cedent_id"])
            raise IrisAPIError(404, "Cedant not found", f"{payload['cedent_id']} does not exist")

        inception_date = date.fromisoformat(payload["inception_date"])
        contract_id = self.repository.get_next_contract_id(inception_date.year)
        contract = Contract(
            contract_id=contract_id,
            contract_name=payload["contract_name"],
            contract_version="v1.0",
            cedent_id=payload["cedent_id"],
            counterparty_role=payload.get("counterparty_role") or "Reinsurer",
            swap_type=payload.get("swap_type"),
            structure=payload.get("structure"),
            master_agreement_ref=payload.get("master_agreement_reference"),
            inception_date=inception_date,
            effective_date=date.fromisoformat(payload["effective_date"]) if payload.get("effective_date") else inception_date,
            maturity_date=date.fromisoformat(payload["maturity_date"]),
            duration_years=payload.get("duration_years"),
            governing_law=payload.get("governing_law"),
            jurisdiction=payload.get("jurisdiction"),
            status="draft",
            notional_amount=payload.get("notional_amount"),
            currency=payload.get("currency"),
            fixed_leg_rate=(float(payload.get("fixed_leg_rate_pct") or 0) / 100),
            fixed_leg_frequency=payload.get("fixed_leg_frequency"),
            floating_leg_definition=payload.get("floating_leg_definition"),
            floating_leg_index=payload.get("floating_leg_index_table"),
            lives_count=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        created = self.repository.create_contract(contract)

        store = self._read_contract_detail_store()
        store.setdefault(contract_id, {}).setdefault("master_data", {})["parent_contract_id"] = payload.get(
            "parent_contract_id"
        ) or ""
        self._append_contract_audit_event(
            store,
            contract_id,
            {
                "timestamp": datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"),
                "actor": "Underwriter",
                "action": "Created contract draft",
                "detail": f"{created.contract_name} for {cedent.legal_entity_name}",
            },
        )
        self._append_contract_compliance_event(
            store,
            contract_id,
            {
                "timestamp": datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"),
                "actor": "Underwriter",
                "type": "Manual",
                "action": "Created contract draft",
                "detail": contract_id,
            },
        )
        self._write_contract_detail_store(store)

        return {"contract_id": created.contract_id, "status": created.status}

    def update_contract_section(self, contract_id: str, section: str, payload: Any) -> dict[str, Any]:
        logger.info("Updating contract section")
        logger.debug("Contract section update contract_id=%s section=%s payload=%s", contract_id, section, payload)
        contract = self.repository.get_contract(contract_id)
        if contract is None:
            logger.error("Contract section update failed for missing contract_id=%s", contract_id)
            raise IrisAPIError(404, "Contract not found", f"{contract_id} does not exist")

        if section not in CONTRACT_SECTION_NAME_MAP:
            logger.error("Contract section update failed for unsupported section=%s", section)
            raise IrisAPIError(400, "Invalid section", f"{section} is not supported")

        response_section = CONTRACT_SECTION_NAME_MAP[section]
        if response_section == "master_data":
            updated = self._update_contract_master_data(contract, payload if isinstance(payload, dict) else {})
            return {"section": response_section, "data": updated}

        if response_section == "economic_terms":
            current = self._build_contract_payload(contract)["economic_terms"]
            if current.get("is_locked"):
                logger.error("Economic terms edit blocked for locked contract_id=%s", contract_id)
                raise IrisAPIError(403, "Section locked", "Economic terms are locked after inception.")
            updated = self._update_contract_economic_terms(contract, payload if isinstance(payload, dict) else {})
            return {"section": response_section, "data": updated}

        store = self._read_contract_detail_store()
        current = self._build_contract_payload(contract)
        merged = self._deep_merge(current[response_section], payload)
        store.setdefault(contract_id, {})[response_section] = merged
        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
        self._append_contract_audit_event(
            store,
            contract_id,
            {
                "timestamp": timestamp,
                "actor": "Underwriter",
                "action": f"Updated {response_section.replace('_', ' ')}",
                "detail": "User-saved section change",
            },
        )
        self._append_contract_compliance_event(
            store,
            contract_id,
            {
                "timestamp": timestamp,
                "actor": "Underwriter",
                "type": "Manual",
                "action": f"Updated {response_section.replace('_', ' ')}",
                "detail": contract_id,
            },
        )
        self._write_contract_detail_store(store)
        return {"section": response_section, "data": merged}

    def create_contract_amendment(self, contract_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        logger.info("Creating contract amendment")
        logger.debug("Contract amendment contract_id=%s payload=%s", contract_id, payload)
        contract = self.repository.get_contract(contract_id)
        if contract is None:
            logger.error("Contract amendment failed for missing contract_id=%s", contract_id)
            raise IrisAPIError(404, "Contract not found", f"{contract_id} does not exist")

        detail = self._build_contract_payload(contract)
        amendment_number = len(detail["amendments"]) + 1
        amendment_id = f"AMD-{amendment_number:03d}"
        next_version = self._increment_version(contract.contract_version or "v1.0", amendment_number)
        amendment = {
            "id": amendment_id,
            "version": next_version,
            "type": payload.get("amendment_type") or "Other",
            "summary": payload["description"],
            "submitted": payload["submitted_date"],
            "effective": payload["effective_date"],
            "status": payload.get("status") or "pending_approval",
            "changed_sections": payload.get("changed_sections") or [],
            "changes": payload.get("changes") or {},
        }

        worklist_item = WorklistItem(
            wl_id=self.repository.get_next_worklist_id(),
            title=f"Contract amendment approval - {contract.contract_id}",
            description=payload["description"],
            category="Override Approval",
            priority="high",
            status="pending_review",
            assigned_role="admin",
            contract_id=contract.contract_id,
            cedent_id=contract.cedent_id,
            source="Human",
            source_detail="Contract amendment",
            breadcrumb="Contract Amendment - Approval Required",
        )
        self.repository.create_worklist_item(worklist_item)

        store = self._read_contract_detail_store()
        amendments = store.setdefault(contract_id, {}).setdefault("amendments", [])
        amendments.insert(0, amendment)
        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
        self._append_contract_audit_event(
            store,
            contract_id,
            {
                "timestamp": timestamp,
                "actor": "Underwriter",
                "action": f"Submitted amendment {next_version}",
                "detail": payload["description"],
            },
        )
        self._append_contract_compliance_event(
            store,
            contract_id,
            {
                "timestamp": timestamp,
                "actor": "Underwriter",
                "type": "Manual",
                "action": "Submitted amendment for approval",
                "detail": amendment_id,
            },
        )
        self._write_contract_detail_store(store)

        return {
            "contract_id": contract.contract_id,
            "amendment_id": amendment_id,
            "status": amendment["status"],
            "worklist_item": worklist_item.wl_id,
        }

    def get_contract_details_performance(self, contract_id: str) -> dict[str, Any]:
        logger.info("Loading contract details and performance")
        logger.debug("Contract details-performance contract_id=%s", contract_id)
        contract = self.repository.get_contract(contract_id)
        if contract is None:
            logger.error("Contract performance failed for missing contract_id=%s", contract_id)
            raise IrisAPIError(404, "Contract not found", f"{contract_id} does not exist")

        return self._build_contract_payload(contract)["details_performance"]

    def get_contract_calculations(
        self,
        contract_id: str,
        metric: str,
        aggregation: str,
        group_by: str,
        from_period: str,
        to_period: str,
    ) -> dict[str, Any]:
        logger.info("Loading contract calculations")
        logger.debug(
            "Contract calculations contract_id=%s metric=%s aggregation=%s group_by=%s from=%s to=%s",
            contract_id,
            metric,
            aggregation,
            group_by,
            from_period,
            to_period,
        )
        contract = self.repository.get_contract(contract_id)
        if contract is None:
            logger.error("Contract calculations failed for missing contract_id=%s", contract_id)
            raise IrisAPIError(404, "Contract not found", f"{contract_id} does not exist")

        detail = self._build_contract_payload(contract)
        settlements = detail["details_performance"]["settlement_history"]
        selected_rows = self._slice_quarter_range(settlements, from_period, to_period)
        if not selected_rows:
            selected_rows = settlements

        grouped_rows = self._group_calculation_rows(selected_rows, metric, aggregation, group_by)
        raw_values = [row["value"] for row in grouped_rows]
        result_value = self._aggregate_values(raw_values, aggregation)
        metric_label = {
            "settlement_variance": "settlements",
            "fixed_leg_total": "fixed leg",
            "floating_leg_total": "floating leg",
            "ae_ratio": "A/E ratios",
        }.get(metric, metric)

        return {
            "metric": metric,
            "aggregation": aggregation,
            "group_by": group_by,
            "from": from_period,
            "to": to_period,
            "result_label": f"{aggregation.upper()} of {metric_label} · {len(grouped_rows)} period(s)",
            "result_value": result_value,
            "currency": detail["currency"],
            "breakdown": grouped_rows,
        }

    def get_contract_member_list(self, contract_id: str, status: str, page: int, page_size: int) -> dict[str, Any]:
        logger.info("Loading contract member list")
        logger.debug("Contract member list contract_id=%s status=%s page=%s page_size=%s", contract_id, status, page, page_size)
        contract = self.repository.get_contract(contract_id)
        if contract is None:
            logger.error("Contract member list failed for missing contract_id=%s", contract_id)
            raise IrisAPIError(404, "Contract not found", f"{contract_id} does not exist")

        return self._build_contract_member_list(contract, status, page, page_size)

    async def upload_contract_members(self, contract_id: str, file: UploadFile) -> dict[str, Any]:
        logger.info("Uploading contract members file")
        logger.debug("Contract members upload contract_id=%s filename=%s", contract_id, file.filename)
        contract = self.repository.get_contract(contract_id)
        if contract is None:
            logger.error("Contract members upload failed for missing contract_id=%s", contract_id)
            raise IrisAPIError(404, "Contract not found", f"{contract_id} does not exist")

        raw_bytes = await file.read()
        try:
            parsed_rows = parse_population_file(file.filename, raw_bytes)
        except ValueError as exc:
            logger.error("Contract members upload failed because the uploaded file could not be parsed contract_id=%s", contract_id)
            raise IrisAPIError(400, "Invalid members file", str(exc)) from exc

        if not parsed_rows:
            logger.error("Contract members upload failed because the file had no usable rows contract_id=%s", contract_id)
            raise IrisAPIError(400, "Invalid members file", "The uploaded file does not contain any population rows")

        normalized_rows, critical_issues, relaxed_fallbacks = self._normalize_contract_upload_rows(contract_id, parsed_rows)
        if critical_issues:
            logger.error(
                "Contract members upload failed validation contract_id=%s issue_count=%s",
                contract_id,
                len(critical_issues),
            )
            details = "; ".join(
                f"row {issue.row_number}: {issue.description}"
                for issue in critical_issues[:5]
            )
            raise IrisAPIError(400, "Invalid members file", details)

        if relaxed_fallbacks["rows_relaxed"] > 0:
            logger.info("Contract members upload applied relaxed population defaults")
            logger.debug(
                "Contract members relaxed upload contract_id=%s rows_relaxed=%s dob_from_existing=%s dob_placeholder=%s pension_from_existing=%s pension_placeholder=%s",
                contract_id,
                relaxed_fallbacks["rows_relaxed"],
                relaxed_fallbacks["date_of_birth_from_existing"],
                relaxed_fallbacks["date_of_birth_placeholder"],
                relaxed_fallbacks["annual_pension_from_existing"],
                relaxed_fallbacks["annual_pension_placeholder"],
            )

        import_summary = self._import_contract_population_snapshot(contract, normalized_rows)

        store = self._read_contract_detail_store()
        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
        self._append_contract_audit_event(
            store,
            contract_id,
            {
                "timestamp": timestamp,
                "actor": "Underwriter",
                "action": "Uploaded members file",
                "detail": file.filename or "uploaded.csv",
            },
        )
        self._append_contract_compliance_event(
            store,
            contract_id,
            {
                "timestamp": timestamp,
                "actor": "Underwriter",
                "type": "Manual",
                "action": "Uploaded members file",
                "detail": file.filename or "uploaded.csv",
            },
        )
        self._write_contract_detail_store(store)

        return {
            "upload_id": f"upl-{contract_id.lower()}-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}",
            "status": "accepted",
            "filename": file.filename,
            "bytes_received": len(raw_bytes),
            "message": self._build_contract_upload_message(import_summary, relaxed_fallbacks),
        }

    def list_population(
        self,
        cedent_id: str | None,
        contract_id: str | None,
        status: str,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        logger.info("Loading population register")
        logger.debug(
            "Population register cedent_id=%s contract_id=%s status=%s page=%s page_size=%s",
            cedent_id,
            contract_id,
            status,
            page,
            page_size,
        )

        cedent_name = "All cedants"
        if cedent_id:
            cedent = self.repository.get_cedent(cedent_id)
            if cedent is None:
                logger.error("Population register failed for missing cedent_id=%s", cedent_id)
                raise IrisAPIError(404, "Cedant not found", f"{cedent_id} does not exist")
            cedent_name = cedent.legal_entity_name

        contract_label = "All contracts"
        if contract_id:
            contract = self.repository.get_contract(contract_id)
            if contract is None:
                logger.error("Population register failed for missing contract_id=%s", contract_id)
                raise IrisAPIError(404, "Contract not found", f"{contract_id} does not exist")
            if cedent_id and contract.cedent_id != cedent_id:
                logger.error(
                    "Population register filter mismatch for cedent_id=%s contract_id=%s contract_cedent_id=%s",
                    cedent_id,
                    contract_id,
                    contract.cedent_id,
                )
                raise IrisAPIError(400, "Invalid population filters", "Selected contract does not belong to the chosen cedant")
            contract_label = contract.contract_id

        records, total = self.repository.list_population_members(cedent_id, contract_id, status, page, page_size)
        seed_last_verified = self._load_population_seed_last_verified_map()
        overrides = self._read_population_overrides()
        items = [self._serialize_population_item(record, seed_last_verified, overrides) for record in records]
        return {
            "total": total,
            "filters_applied": {
                "cedent": cedent_name,
                "contract": contract_label,
                "status": status or "all",
            },
            "items": items,
        }

    def get_population_history(self, member_id: str) -> dict[str, Any]:
        logger.info("Loading population history")
        logger.debug("Population history member_id=%s", member_id)
        records = self.repository.list_population_history(member_id)
        if not records:
            logger.error("Population history not found for member_id=%s", member_id)
            raise IrisAPIError(404, "Member not found", f"{member_id} does not exist")

        return {
            "member_id": member_id,
            "history": [
                {
                    "effective_from": record.effective_from.isoformat(),
                    "effective_to": record.effective_to.isoformat() if record.effective_to else None,
                    "status": record.status,
                    "annual_pension": float(record.annual_pension or 0),
                    "is_current": bool(record.is_current),
                }
                for record in records
            ],
        }

    def defer_population_member(self, member_id: str) -> dict[str, Any]:
        logger.info("Deferring population member")
        logger.debug("Population defer member_id=%s", member_id)
        current_record = self.repository.get_current_population_member(member_id)
        if current_record is None:
            logger.error("Population defer failed for missing member_id=%s", member_id)
            raise IrisAPIError(404, "Member not found", f"{member_id} does not exist")

        if current_record.status.lower() != "active":
            logger.error(
                "Population defer failed for non-active member_id=%s current_status=%s",
                member_id,
                current_record.status,
            )
            raise IrisAPIError(
                409,
                "Invalid member status",
                f"{member_id} is currently {current_record.status} and cannot be deferred",
            )

        today = date.today()
        current_record.is_current = False
        current_record.effective_to = today if current_record.effective_from >= today else today - timedelta(days=1)

        deferred_record = PolicyRegister(
            contract_id=current_record.contract_id,
            member_id=current_record.member_id,
            policy_id=current_record.policy_id,
            date_of_birth=current_record.date_of_birth,
            gender=current_record.gender,
            smoker_status=current_record.smoker_status,
            postcode=current_record.postcode,
            annual_pension=float(current_record.annual_pension or 0),
            pension_currency=current_record.pension_currency,
            escalation_type=current_record.escalation_type,
            escalation_rate=float(current_record.escalation_rate or 0)
            if current_record.escalation_rate is not None
            else None,
            status="deferred",
            date_of_death=None,
            commencement_date=current_record.commencement_date,
            effective_from=today,
            effective_to=None,
            is_current=True,
            source_cession_file_id=current_record.source_cession_file_id,
            created_at=datetime.utcnow(),
        )
        created = self.repository.defer_population_member(current_record, deferred_record)

        overrides = self._read_population_overrides()
        overrides.setdefault(member_id, {})["last_verified"] = today.isoformat()
        self._write_population_overrides(overrides)

        return {
            "member_id": created.member_id,
            "status": created.status,
            "effective_from": created.effective_from.isoformat(),
        }

    def _serialize_cedent_list_item(self, cedent: Cedent) -> dict[str, Any]:
        return {
            "cedent_id": cedent.cedent_id,
            "legal_entity_name": cedent.legal_entity_name,
            "country": cedent.country_of_registration,
            "aum": self._format_billions(cedent.aum_amount, cedent.aum_currency or "USD"),
            "contracts_count": self._contracts_count(cedent.cedent_id),
            "screening_status": cedent.screening_status,
            "status": cedent.status,
            "onboarded_date": cedent.onboarded_date.isoformat() if cedent.onboarded_date else None,
            "actions": ["view", "edit"],
        }

    def _contracts_count(self, cedent_id: str) -> int:
        return len(self.repository.list_contracts_for_cedent(cedent_id))

    def _build_cedent_payload(self, cedent: Cedent, contracts: list[Contract]) -> dict[str, Any]:
        store = self._read_detail_store()
        detail = self._deep_merge(self._default_detail_store(cedent, contracts), store.get(cedent.cedent_id, {}))
        audit_approval = self._load_cedent_audit_timeline(cedent.cedent_id, detail["audit_approval"])

        legal_entity = {
            "cedent_id": cedent.cedent_id,
            "legal_entity_name": cedent.legal_entity_name,
            "trading_name": cedent.trading_name or "",
            "registered_company_number": cedent.registered_company_number or "",
            "tax_identification_number": cedent.tax_identification_number or "",
            "lei": cedent.lei or "",
            "entity_type": cedent.entity_type or "",
            "jurisdiction_of_incorporation": cedent.jurisdiction or "",
            "country_of_registration": cedent.country_of_registration or "",
            "date_of_incorporation": cedent.date_of_incorporation.isoformat() if cedent.date_of_incorporation else "",
            "regulatory_status": cedent.regulatory_status or "",
            "ownership_structure": cedent.ownership_structure or "",
            "parent_company": cedent.parent_company or "",
            "group_structure": cedent.group_structure or "",
        }

        mapped_contracts = [self._serialize_mapped_contract(contract) for contract in contracts]
        return {
            "cedent_id": cedent.cedent_id,
            "legal_entity_name": cedent.legal_entity_name,
            "status": cedent.status,
            "screening_status": cedent.screening_status,
            "country": cedent.country_of_registration,
            "aum": float(cedent.aum_amount or 0),
            "aum_currency": cedent.aum_currency or "USD",
            "contracts_count": len(mapped_contracts),
            "onboarded_date": cedent.onboarded_date.isoformat() if cedent.onboarded_date else None,
            "legal_entity": legal_entity,
            "pension_scheme": detail["pension_scheme"],
            "key_contacts": detail["key_contacts"],
            "financial_treasury": detail["financial_treasury"],
            "contract_readiness": detail["contract_readiness"],
            "population_exposure": detail["population_exposure"],
            "compliance_kyc": detail["compliance_kyc"],
            "sanction_screening": detail["sanction_screening"],
            "regulatory_docs": detail["regulatory_docs"],
            "operational_connectivity": detail["operational_connectivity"],
            "actuarial_preferences": detail["actuarial_preferences"],
            "access_beneficiary_rules": detail["access_beneficiary_rules"],
            "audit_approval": audit_approval,
            "mapped_contracts": mapped_contracts,
            "calculations": {
                "status": "spec_gap",
                "message": "Cedant-level calculation endpoint is not defined in the underwriting API spec yet.",
            },
        }

    def _serialize_mapped_contract(self, contract: Contract) -> dict[str, Any]:
        return {
            "contract_id": contract.contract_id,
            "contract_name": contract.contract_name,
            "notional": float(contract.notional_amount or 0),
            "currency": contract.currency or "USD",
            "status": contract.status,
            "inception_date": contract.inception_date.isoformat() if contract.inception_date else None,
            "lives": contract.lives_count or 0,
        }

    def _update_legal_entity(self, cedent: Cedent, payload: dict[str, Any]) -> dict[str, Any]:
        field_map = {
            "legal_entity_name": "legal_entity_name",
            "trading_name": "trading_name",
            "registered_company_number": "registered_company_number",
            "tax_identification_number": "tax_identification_number",
            "lei": "lei",
            "entity_type": "entity_type",
            "jurisdiction_of_incorporation": "jurisdiction",
            "country_of_registration": "country_of_registration",
            "regulatory_status": "regulatory_status",
            "ownership_structure": "ownership_structure",
            "parent_company": "parent_company",
            "group_structure": "group_structure",
        }
        for payload_key, model_key in field_map.items():
            if payload_key in payload:
                setattr(cedent, model_key, payload[payload_key] or None)

        if payload.get("date_of_incorporation"):
            cedent.date_of_incorporation = date.fromisoformat(payload["date_of_incorporation"])

        cedent.updated_at = datetime.utcnow()
        updated = self.repository.update_cedent(cedent)
        return self._build_cedent_payload(updated, self.repository.list_contracts_for_cedent(updated.cedent_id))["legal_entity"]

    def _serialize_contract_list_item(self, contract: Contract) -> dict[str, Any]:
        cedent = self.repository.get_cedent(contract.cedent_id) if contract.cedent_id else None
        return {
            "contract_id": contract.contract_id,
            "contract_name": contract.contract_name,
            "cedent_id": contract.cedent_id,
            "cedent_name": cedent.legal_entity_name if cedent else "Unmapped Cedant",
            "notional": float(contract.notional_amount or 0),
            "currency": contract.currency or "USD",
            "fixed_rate": float(contract.fixed_leg_rate or 0),
            "floating_definition": contract.floating_leg_definition or "",
            "inception_date": contract.inception_date.isoformat() if contract.inception_date else None,
            "maturity_date": contract.maturity_date.isoformat() if contract.maturity_date else None,
            "lives_count": contract.lives_count or 0,
            "version": contract.contract_version or "v1.0",
            "status": contract.status,
            "actions": ["view", "members", "amend"],
        }

    def _build_contract_payload(self, contract: Contract) -> dict[str, Any]:
        cedent = self.repository.get_cedent(contract.cedent_id) if contract.cedent_id else None
        cedent_name = cedent.legal_entity_name if cedent else "Unmapped Cedant"
        store = self._read_contract_detail_store()
        detail = self._deep_merge(self._default_contract_store(contract, cedent_name), store.get(contract.contract_id, {}))
        detail["details_performance"] = self._enrich_contract_performance(detail, contract, cedent_name)
        audit_approval = self._load_contract_audit_timeline(contract.contract_id, detail["audit_approval"])
        audit_compliance = self._load_contract_compliance_trail(contract.contract_id, detail["audit_compliance"])
        return {
            "contract_id": contract.contract_id,
            "contract_name": contract.contract_name,
            "cedent_id": contract.cedent_id,
            "cedent_name": cedent_name,
            "status": contract.status,
            "renewal_date": detail["renewal_date"],
            "notional": float(contract.notional_amount or 0),
            "currency": contract.currency or detail["economic_terms"]["currency"],
            "lives_count": contract.lives_count or detail["reference_pool"]["lives_covered"],
            "version": contract.contract_version or "v1.0",
            "master_data": detail["master_data"],
            "economic_terms": detail["economic_terms"],
            "reference_pool": detail["reference_pool"],
            "actuarial_basis": detail["actuarial_basis"],
            "risk_limits": detail["risk_limits"],
            "operational_terms": detail["operational_terms"],
            "compliance_docs": detail["compliance_docs"],
            "audit_approval": audit_approval,
            "details_performance": detail["details_performance"],
            "file_templates": detail["file_templates"],
            "amendments": detail["amendments"],
            "audit_compliance": audit_compliance,
            "member_population": detail["member_population"],
        }

    def _update_contract_master_data(self, contract: Contract, payload: dict[str, Any]) -> dict[str, Any]:
        field_map = {
            "contract_name": "contract_name",
            "cedent_id": "cedent_id",
            "counterparty_role": "counterparty_role",
            "swap_type": "swap_type",
            "structure": "structure",
            "master_agreement_reference": "master_agreement_ref",
            "duration_years": "duration_years",
            "governing_law": "governing_law",
            "jurisdiction": "jurisdiction",
            "status": "status",
        }
        for payload_key, model_key in field_map.items():
            if payload_key in payload:
                if payload_key == "cedent_id" and payload[payload_key]:
                    if self.repository.get_cedent(payload[payload_key]) is None:
                        logger.error("Master data update failed for missing cedent_id=%s", payload[payload_key])
                        raise IrisAPIError(404, "Cedant not found", f"{payload[payload_key]} does not exist")
                setattr(contract, model_key, payload[payload_key] or None)

        if payload.get("inception_date"):
            contract.inception_date = date.fromisoformat(payload["inception_date"])
        if payload.get("effective_date"):
            contract.effective_date = date.fromisoformat(payload["effective_date"])
        if payload.get("maturity_date"):
            contract.maturity_date = date.fromisoformat(payload["maturity_date"])

        contract.updated_at = datetime.utcnow()
        updated = self.repository.update_contract(contract)

        store = self._read_contract_detail_store()
        if "parent_contract_id" in payload:
            store.setdefault(contract.contract_id, {}).setdefault("master_data", {})["parent_contract_id"] = payload.get(
                "parent_contract_id"
            ) or ""
        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
        self._append_contract_audit_event(
            store,
            contract.contract_id,
            {
                "timestamp": timestamp,
                "actor": "Underwriter",
                "action": "Updated master data",
                "detail": updated.contract_name,
            },
        )
        self._append_contract_compliance_event(
            store,
            contract.contract_id,
            {
                "timestamp": timestamp,
                "actor": "Underwriter",
                "type": "Manual",
                "action": "Updated master data",
                "detail": contract.contract_id,
            },
        )
        self._write_contract_detail_store(store)
        return self._build_contract_payload(updated)["master_data"]

    def _update_contract_economic_terms(self, contract: Contract, payload: dict[str, Any]) -> dict[str, Any]:
        if "notional_amount" in payload:
            contract.notional_amount = float(payload["notional_amount"] or 0)
        if "currency" in payload:
            contract.currency = payload["currency"] or None
        if "fixed_leg_rate_pct" in payload:
            contract.fixed_leg_rate = float(payload["fixed_leg_rate_pct"] or 0) / 100
        if "fixed_leg_frequency" in payload:
            contract.fixed_leg_frequency = payload["fixed_leg_frequency"] or None
        if "floating_leg_definition" in payload:
            contract.floating_leg_definition = payload["floating_leg_definition"] or None
        if "floating_leg_index_table" in payload:
            contract.floating_leg_index = payload["floating_leg_index_table"] or None

        contract.updated_at = datetime.utcnow()
        updated = self.repository.update_contract(contract)

        overlay_payload = {
            key: value
            for key, value in payload.items()
            if key
            not in {
                "notional_amount",
                "currency",
                "fixed_leg_rate_pct",
                "fixed_leg_frequency",
                "floating_leg_definition",
                "floating_leg_index_table",
            }
        }
        store = self._read_contract_detail_store()
        current_section = self._build_contract_payload(updated)["economic_terms"]
        merged = self._deep_merge(current_section, overlay_payload)
        store.setdefault(contract.contract_id, {})["economic_terms"] = merged
        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
        self._append_contract_audit_event(
            store,
            contract.contract_id,
            {
                "timestamp": timestamp,
                "actor": "Underwriter",
                "action": "Updated economic terms",
                "detail": "User-saved section change",
            },
        )
        self._append_contract_compliance_event(
            store,
            contract.contract_id,
            {
                "timestamp": timestamp,
                "actor": "Underwriter",
                "type": "Manual",
                "action": "Updated economic terms",
                "detail": contract.contract_id,
            },
        )
        self._write_contract_detail_store(store)
        return self._build_contract_payload(updated)["economic_terms"]

    def _read_detail_store(self) -> dict[str, Any]:
        if not DETAIL_OVERRIDES_FILE.exists():
            return {}
        with DETAIL_OVERRIDES_FILE.open("r", encoding="utf-8") as file:
            return json.load(file)

    def _write_detail_store(self, payload: dict[str, Any]) -> None:
        with DETAIL_OVERRIDES_FILE.open("w", encoding="utf-8") as file:
            json.dump(payload, file, indent=2)

    def _read_contract_detail_store(self) -> dict[str, Any]:
        if not CONTRACT_DETAIL_OVERRIDES_FILE.exists():
            return {}
        with CONTRACT_DETAIL_OVERRIDES_FILE.open("r", encoding="utf-8") as file:
            return json.load(file)

    def _write_contract_detail_store(self, payload: dict[str, Any]) -> None:
        with CONTRACT_DETAIL_OVERRIDES_FILE.open("w", encoding="utf-8") as file:
            json.dump(payload, file, indent=2)

    def _read_population_overrides(self) -> dict[str, Any]:
        if not POPULATION_OVERRIDES_FILE.exists():
            return {}
        with POPULATION_OVERRIDES_FILE.open("r", encoding="utf-8") as file:
            return json.load(file)

    def _write_population_overrides(self, payload: dict[str, Any]) -> None:
        with POPULATION_OVERRIDES_FILE.open("w", encoding="utf-8") as file:
            json.dump(payload, file, indent=2)

    def _deep_merge(self, base: Any, override: Any) -> Any:
        if isinstance(base, dict) and isinstance(override, dict):
            merged = deepcopy(base)
            for key, value in override.items():
                merged[key] = self._deep_merge(merged.get(key), value) if key in merged else value
            return merged
        return deepcopy(override)

    def _append_audit_event(self, store: dict[str, Any], cedent_id: str, event: dict[str, Any]) -> None:
        audit_events = store.setdefault(cedent_id, {}).setdefault("audit_approval", [])
        audit_events.insert(0, event)
        self._persist_underwriting_audit_event(
            module="contract",
            entity_id=cedent_id,
            entity_type="cedent",
            event=event,
            cedent_id=cedent_id,
        )

    def _append_contract_audit_event(self, store: dict[str, Any], contract_id: str, event: dict[str, Any]) -> None:
        audit_events = store.setdefault(contract_id, {}).setdefault("audit_approval", [])
        audit_events.insert(0, event)
        contract = self.repository.get_contract(contract_id)
        self._persist_underwriting_audit_event(
            module="contract",
            entity_id=contract_id,
            entity_type="contract",
            event=event,
            contract_id=contract_id,
            cedent_id=contract.cedent_id if contract else None,
        )

    def _append_contract_compliance_event(self, store: dict[str, Any], contract_id: str, event: dict[str, Any]) -> None:
        audit_trail = store.setdefault(contract_id, {}).setdefault("audit_compliance", {}).setdefault("audit_trail", [])
        audit_trail.insert(0, event)
        contract = self.repository.get_contract(contract_id)
        self._persist_underwriting_audit_event(
            module="cession",
            entity_id=contract_id,
            entity_type="contract",
            event=event,
            contract_id=contract_id,
            cedent_id=contract.cedent_id if contract else None,
        )

    def _load_cedent_audit_timeline(self, cedent_id: str, fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
        events = self.repository.list_audit_events_for_cedent(cedent_id)
        if not events:
            return fallback
        return [self._serialize_timeline_event(event) for event in events[:20]]

    def _load_contract_audit_timeline(self, contract_id: str, fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
        events = [
            event
            for event in self.repository.list_audit_events_for_contract(contract_id)
            if event.entity_id == contract_id or event.module == "contract"
        ]
        if not events:
            return fallback
        return [self._serialize_timeline_event(event) for event in events[:20]]

    def _load_contract_compliance_trail(self, contract_id: str, fallback: dict[str, Any]) -> dict[str, Any]:
        events = [
            event
            for event in self.repository.list_audit_events_for_contract(contract_id)
            if event.module in {"cession", "settlement", "calculation", "contract"}
        ]
        if not events:
            return fallback
        return {
            **fallback,
            "audit_trail": [self._serialize_compliance_event(event) for event in events[:20]],
        }

    def _serialize_timeline_event(self, event: AuditEvent) -> dict[str, Any]:
        return {
            "timestamp": self._format_audit_timestamp(event.timestamp),
            "actor": event.actor_id or self._display_actor_name(event.actor_type),
            "action": event.event_type,
            "detail": event.description,
        }

    def _serialize_compliance_event(self, event: AuditEvent) -> dict[str, Any]:
        return {
            "timestamp": self._format_audit_timestamp(event.timestamp),
            "actor": event.actor_id or self._display_actor_name(event.actor_type),
            "type": self._display_actor_type(event.actor_type),
            "action": event.event_type,
            "detail": event.description,
        }

    def _persist_underwriting_audit_event(
        self,
        *,
        module: str,
        entity_id: str,
        entity_type: str,
        event: dict[str, Any],
        contract_id: str | None = None,
        cedent_id: str | None = None,
    ) -> None:
        timestamp = self._parse_audit_timestamp(event.get("timestamp"))
        logger.info("Persisting underwriting audit event")
        logger.debug(
            "Underwriting audit persist module=%s entity_id=%s contract_id=%s cedent_id=%s",
            module,
            entity_id,
            contract_id,
            cedent_id,
        )
        self.repository.create_audit_event(
            AuditEvent(
                audit_id=self.repository.get_next_audit_id(timestamp.astimezone(UTC).strftime("%Y-%m-%d")),
                timestamp=timestamp,
                module=module,
                event_type=event.get("action") or "Audit Event",
                actor_type=self._audit_actor_type(event),
                actor_id=event.get("actor"),
                entity_id=entity_id,
                entity_type=entity_type,
                description=event.get("detail") or event.get("action") or "Audit Event",
                approval_status=self._audit_approval_status(event.get("action")),
                contract_id=contract_id,
                cedent_id=cedent_id,
            )
        )

    def _parse_audit_timestamp(self, value: Any) -> datetime:
        if not isinstance(value, str) or not value:
            return datetime.now(UTC)
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)

    def _format_audit_timestamp(self, value: datetime | None) -> str:
        if value is None:
            return ""
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).strftime("%Y-%m-%d %H:%M:%S")

    def _audit_actor_type(self, event: dict[str, Any]) -> str:
        explicit_type = str(event.get("type") or "").strip().lower()
        if explicit_type in {"human", "manual"}:
            return "human"
        if explicit_type in {"ai agent", "ai"}:
            return "ai"
        if explicit_type == "system":
            return "system"

        actor = str(event.get("actor") or "").lower()
        if "agent" in actor or actor.startswith("ai "):
            return "ai"
        if any(keyword in actor for keyword in ["iris", "engine", "system", "listener", "orchestrator", "router"]):
            return "system"
        return "human"

    def _audit_approval_status(self, action: Any) -> str:
        normalized = str(action or "").lower()
        if "approved" in normalized or "completed compliance review" in normalized:
            return "approved"
        if "rejected" in normalized:
            return "rejected"
        if "pending" in normalized or "review" in normalized or "queued" in normalized:
            return "pending"
        return "n/a"

    def _display_actor_name(self, actor_type: str) -> str:
        return {"human": "Human User", "ai": "IRiS Agent", "system": "System"}.get(actor_type, "System")

    def _display_actor_type(self, actor_type: str) -> str:
        return {"human": "Manual", "ai": "AI Agent", "system": "System"}.get(actor_type, "System")

    def _load_population_seed_last_verified_map(self) -> dict[str, str]:
        if not POPULATION_SEED_FILE.exists():
            return {}

        with POPULATION_SEED_FILE.open("r", encoding="utf-8") as file:
            payload = json.load(file)

        last_verified_map: dict[str, str] = {}
        for record in payload:
            member_id = record.get("member_id")
            last_verified = record.get("last_verified")
            if not member_id or not last_verified:
                continue
            if record.get("is_current", True) or member_id not in last_verified_map:
                last_verified_map[member_id] = last_verified
        return last_verified_map

    def _serialize_population_item(
        self,
        record: PolicyRegister,
        seed_last_verified: dict[str, str],
        overrides: dict[str, Any],
    ) -> dict[str, Any]:
        last_verified = self._resolve_population_last_verified(
            record.member_id,
            record.effective_from,
            seed_last_verified,
            overrides,
        )
        return {
            "member_id": record.member_id,
            "contract_id": record.contract_id,
            "age": self._calculate_age(record.date_of_birth, last_verified),
            "gender": record.gender,
            "annual_pension": float(record.annual_pension or 0),
            "currency": record.pension_currency or "GBP",
            "status": record.status,
            "last_verified": last_verified,
        }

    def _resolve_population_last_verified(
        self,
        member_id: str,
        effective_from: date,
        seed_last_verified: dict[str, str],
        overrides: dict[str, Any],
    ) -> str:
        # MOCK IMPLEMENTATION:
        # The population UI/API spec requires `last_verified`, but docs/SCHEMA.md does not
        # define a backing column on `policy_register`. We therefore serve it from seed
        # metadata plus a small override file for user-triggered updates until the schema
        # is explicitly extended in a future spec revision.
        override_value = overrides.get(member_id, {}).get("last_verified")
        if isinstance(override_value, str) and override_value:
            return override_value

        seed_value = seed_last_verified.get(member_id)
        if seed_value:
            return seed_value

        return effective_from.isoformat()

    def _calculate_age(self, date_of_birth: date, reference_date: str | None = None) -> int:
        as_of_date = date.today()
        if reference_date:
            try:
                as_of_date = date.fromisoformat(reference_date)
            except ValueError:
                as_of_date = date.today()

        return as_of_date.year - date_of_birth.year - (
            (as_of_date.month, as_of_date.day) < (date_of_birth.month, date_of_birth.day)
        )

    def _default_detail_store(self, cedent: Cedent, contracts: list[Contract]) -> dict[str, Any]:
        country = cedent.country_of_registration or "UK"
        currency = self._default_currency(country)
        total_lives = sum(contract.lives_count or 0 for contract in contracts)
        total_notional = sum(float(contract.notional_amount or 0) for contract in contracts)
        number_suffix = cedent.cedent_id.split("-")[-1]

        return {
            "pension_scheme": {
                "scheme_id": f"PS-{number_suffix}",
                "scheme_name": f"{cedent.legal_entity_name} Defined Benefit Scheme",
                "scheme_type": "Defined Benefit",
                "trustee_name": f"{cedent.legal_entity_name} Trustee",
                "scheme_registration_number": f"REG-{number_suffix}",
                "scheme_country": country,
                "scheme_currency": currency,
                "benefit_type": "Final Salary",
                "retirement_age_rules": "Normal Retirement Age 65",
                "indexation_rules": "",
                "spouse_benefits": "",
                "guaranteed_period_rules": "",
                "deferred_member_rules": "",
            },
            "key_contacts": [
                {
                    "category": "Executive Sponsor",
                    "full_name": "",
                    "designation": "",
                    "department": "",
                    "email": "",
                    "phone": "",
                    "mobile": "",
                    "preferred_contact": "Email",
                    "language": "English",
                }
            ],
            "financial_treasury": {
                "bank_name": "",
                "account_number": "",
                "sort_code": "",
                "iban": "",
                "swift_bic": "",
                "account_currency": currency,
                "payment_method": "Wire",
                "settlement_instructions": "",
            },
            "contract_readiness": {
                "isda_signed": False,
                "isda_date": "",
                "csa_signed": False,
                "csa_date": "",
                "nda_signed": False,
                "nda_date": "",
                "kyc_complete": False,
                "aml_complete": False,
                "data_sharing_agreed": False,
                "file_format_agreed": False,
                "sftp_configured_tested": False,
                "notes": "",
            },
            "population_exposure": {
                "total_lives": total_lives,
                "average_age": 71 if total_lives else 0,
                "pct_male": 55,
                "pct_female": 45,
                "total_annuity_pa_amount": total_notional / 50000 if total_notional else 0,
                "currency": currency,
                "avg_annuity_per_life": 24500 if total_lives else 0,
                "geographic_spread": "",
                "age_distribution": "",
                "mortality_table_used": "CMI S3",
            },
            "compliance_kyc": {
                "kyc_status": "complete" if cedent.screening_status == "cleared" else "pending",
                "kyc_completed_date": "2025-03-15" if cedent.screening_status == "cleared" else "",
                "kyc_provider": "IRiS Compliance Hub",
                "aml_status": "complete" if cedent.screening_status == "cleared" else "pending",
                "pep_check_done": True,
                "beneficial_owner_verified": True,
                "high_risk_jurisdiction": cedent.screening_status == "review",
                "risk_rating": "high" if cedent.screening_status == "review" else "medium",
                "review_frequency": "annual",
                "next_review_date": "2026-03-15",
                "notes": "",
            },
            "sanction_screening": {
                "total_scans": 2,
                "open_hits": 0 if cedent.screening_status == "cleared" else 1,
                "sources_monitored": 2,
                "next_periodic_due": "2025-09-15",
                "source_status": [
                    {
                        "source": "OFAC",
                        "status": "Review" if cedent.screening_status == "review" else "Cleared",
                        "last_scan": "2025-03-15",
                        "reference": "REF-50000",
                        "matches": 1 if cedent.screening_status == "review" else 0,
                    },
                    {
                        "source": "FinCEN",
                        "status": "Cleared",
                        "last_scan": "2025-03-15",
                        "reference": "REF-50001",
                        "matches": 0,
                    },
                ],
                "history": [
                    {
                        "id": f"{cedent.cedent_id}-OFAC-001",
                        "screening_date": "2025-03-15T00:00:00Z",
                        "source": "OFAC",
                        "result": "review" if cedent.screening_status == "review" else "cleared",
                        "reference_id": "REF-50000",
                        "matches": 1 if cedent.screening_status == "review" else 0,
                    },
                    {
                        "id": f"{cedent.cedent_id}-FINCEN-001",
                        "screening_date": "2025-03-15T00:00:00Z",
                        "source": "FinCEN",
                        "result": "cleared",
                        "reference_id": "REF-50001",
                        "matches": 0,
                    },
                ],
            },
            "regulatory_docs": [],
            "operational_connectivity": {
                "sftp_host": f"sftp.{cedent.cedent_id.lower()}.iris.local",
                "sftp_port": 22,
                "sftp_username": f"{cedent.cedent_id.lower()}_ops",
                "sftp_key_fingerprint": "",
                "sftp_status": "healthy",
                "file_format": "CSV",
                "file_encoding": "UTF-8",
                "submission_frequency": "Quarterly",
                "notification_email": "",
            },
            "actuarial_preferences": {
                "mortality_table": "CMI S3",
                "improvement_scale": "CMI 2022",
                "base_year": 2022,
                "long_term_rate": 1.5,
                "initial_rate": 7.0,
                "convergence_period": 15,
                "age_rating_adjustment": 0.0,
                "loading_factor": 0.038,
                "discount_rate": 3.2,
                "discount_basis": "Gilts + 0.50%",
                "valuation_method": "PV of expected cash flows",
                "experience_study_frequency": "Annual",
                "notes": "",
            },
            "access_beneficiary_rules": [
                {
                    "rule_type": "spousal",
                    "pct_benefit": 50,
                    "conditions": "",
                    "rule_description": "",
                }
            ],
            "audit_approval": [
                {
                    "timestamp": "2026-05-05 10:30:00",
                    "actor": "IRiS Bootstrap",
                    "action": "Seeded cedant profile",
                    "detail": "Default underwriting data prepared",
                }
            ],
        }

    def _build_contract_member_list(self, contract: Contract, status: str, page: int, page_size: int) -> dict[str, Any]:
        live_rows = self.repository.list_current_population_for_contract(contract.contract_id)
        if live_rows:
            return self._build_live_contract_member_list(contract, live_rows, status, page, page_size)

        detail = self._build_contract_payload(contract)
        summary = detail["member_population"]
        items = self._generate_contract_members(contract, summary)
        if status and status != "all":
            filtered = [item for item in items if item["status"].lower() == status.lower()]
        else:
            filtered = items

        start_index = max(page - 1, 0) * page_size
        paginated_items = filtered[start_index : start_index + page_size]
        return {
            "contract_id": contract.contract_id,
            "total": len(filtered),
            "page": page,
            "page_size": page_size,
            "summary": summary,
            "items": paginated_items,
        }

    def _build_live_contract_member_list(
        self,
        contract: Contract,
        live_rows: list[PolicyRegister],
        status: str,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        seed_last_verified = self._load_population_seed_last_verified_map()
        overrides = self._read_population_overrides()
        items = [
            self._serialize_contract_population_member(record, seed_last_verified, overrides)
            for record in live_rows
        ]
        if status and status != "all":
            filtered = [item for item in items if item["status"].lower() == status.lower()]
        else:
            filtered = items

        start_index = max(page - 1, 0) * page_size
        paginated_items = filtered[start_index : start_index + page_size]
        return {
            "contract_id": contract.contract_id,
            "total": len(filtered),
            "page": page,
            "page_size": page_size,
            "summary": self._build_live_contract_member_summary(items, contract.currency or "USD"),
            "items": paginated_items,
        }

    def _build_live_contract_member_summary(
        self,
        items: list[dict[str, Any]],
        default_currency: str,
    ) -> dict[str, Any]:
        if not items:
            return {
                "total_members": 0,
                "active_members": 0,
                "deferred_members": 0,
                "spouse_members": 0,
                "deceased_members": 0,
                "currency": default_currency,
                "last_verified_date": date.today().isoformat(),
            }

        return {
            "total_members": len(items),
            "active_members": sum(1 for item in items if item["status"] == "active"),
            "deferred_members": sum(1 for item in items if item["status"] == "deferred"),
            "spouse_members": 0,
            "deceased_members": sum(1 for item in items if item["status"] == "deceased"),
            "currency": items[0]["currency"] or default_currency,
            "last_verified_date": max(item["last_verified"] for item in items),
        }

    def _serialize_contract_population_member(
        self,
        record: PolicyRegister,
        seed_last_verified: dict[str, str],
        overrides: dict[str, Any],
    ) -> dict[str, Any]:
        last_verified = self._resolve_population_last_verified(
            record.member_id,
            record.effective_from,
            seed_last_verified,
            overrides,
        )
        return {
            "member_id": record.member_id,
            "name": record.policy_id or record.member_id,
            "age": self._calculate_age(record.date_of_birth, last_verified),
            "gender": record.gender,
            "annuity_amount": float(record.annual_pension or 0),
            "currency": record.pension_currency or "GBP",
            "status": record.status,
            "last_verified": last_verified,
            "defer_reason": "Benefit verification hold" if record.status == "deferred" else "",
        }

    def _import_contract_population_snapshot(
        self,
        contract: Contract,
        rows: list[PopulationCsvNormalizedRow],
    ) -> dict[str, int]:
        member_ids = [row.member_id for row in rows]
        current_rows = {
            row.member_id: row
            for row in self.repository.list_current_population_for_members(contract.contract_id, member_ids)
        }
        rows_to_save: list[PolicyRegister] = []
        summary = {"created": 0, "updated": 0, "unchanged": 0}

        for row in rows:
            current = current_rows.get(row.member_id)
            effective_from = row.effective_from or date.today()
            if current is None:
                rows_to_save.append(self._build_population_record(contract.contract_id, row, effective_from, None))
                summary["created"] += 1
                continue

            if self._population_rows_match(current, row):
                summary["unchanged"] += 1
                continue

            if effective_from <= current.effective_from:
                effective_from = current.effective_from + timedelta(days=1)

            current.is_current = False
            current.effective_to = effective_from - timedelta(days=1)
            rows_to_save.append(current)
            rows_to_save.append(self._build_population_record(contract.contract_id, row, effective_from, None))
            summary["updated"] += 1

        if rows_to_save:
            self.repository.save_population_records(rows_to_save)

        logger.info("Imported contract population snapshot")
        logger.debug(
            "Population import contract_id=%s created=%s updated=%s unchanged=%s",
            contract.contract_id,
            summary["created"],
            summary["updated"],
            summary["unchanged"],
        )
        return summary

    def _build_population_record(
        self,
        contract_id: str,
        row: PopulationCsvNormalizedRow,
        effective_from: date,
        source_cession_file_id: str | None,
    ) -> PolicyRegister:
        return PolicyRegister(
            contract_id=contract_id,
            member_id=row.member_id,
            policy_id=row.policy_id,
            date_of_birth=row.date_of_birth,
            gender=row.gender,
            smoker_status=row.smoker_status,
            postcode=row.postcode,
            annual_pension=float(row.annual_pension),
            pension_currency=row.pension_currency,
            escalation_type=row.escalation_type,
            escalation_rate=float(row.escalation_rate) if row.escalation_rate is not None else None,
            status=row.status,
            date_of_death=row.date_of_death,
            commencement_date=row.commencement_date,
            effective_from=effective_from,
            effective_to=None,
            is_current=True,
            source_cession_file_id=source_cession_file_id,
            created_at=datetime.now(UTC),
        )

    def _normalize_contract_upload_rows(
        self,
        contract_id: str,
        parsed_rows: list[Any],
    ) -> tuple[list[PopulationCsvNormalizedRow], list[Any], dict[str, int]]:
        member_ids = [
            member_id
            for member_id in (
                self._population_upload_member_id(row_result)
                for row_result in parsed_rows
            )
            if member_id
        ]
        current_rows = {
            row.member_id: row
            for row in self.repository.list_current_population_for_members(contract_id, member_ids)
        }
        normalized_rows: list[PopulationCsvNormalizedRow] = []
        critical_issues: list[Any] = []
        relaxed_fallbacks = {
            "rows_relaxed": 0,
            "date_of_birth_from_existing": 0,
            "date_of_birth_placeholder": 0,
            "annual_pension_from_existing": 0,
            "annual_pension_placeholder": 0,
        }

        for row_result in parsed_rows:
            blocking_issues = [
                issue
                for issue in row_result.issues
                if issue.severity == "critical" and not self._is_relaxed_population_upload_issue(issue)
            ]
            if blocking_issues:
                critical_issues.extend(blocking_issues)
                continue

            normalized = row_result.normalized
            if normalized is None:
                normalized = self._coerce_relaxed_contract_upload_row(
                    row_result.raw_data,
                    current_rows.get(self._population_upload_member_id(row_result)),
                    relaxed_fallbacks,
                )
                if normalized is None:
                    critical_issues.extend(issue for issue in row_result.issues if issue.severity == "critical")
                    continue

            normalized_rows.append(normalized)

        return normalized_rows, critical_issues, relaxed_fallbacks

    def _population_upload_member_id(self, row_result: Any) -> str | None:
        if row_result.normalized is not None:
            return row_result.normalized.member_id
        return self._population_upload_value(row_result.raw_data, "member_id", "pensioner_ref")

    def _is_relaxed_population_upload_issue(self, issue: Any) -> bool:
        return issue.field_name in {"date_of_birth", "annual_pension"} and issue.issue_type in {
            "missing_required_field",
            "invalid_date",
            "invalid_number",
        }

    def _coerce_relaxed_contract_upload_row(
        self,
        raw_data: dict[str, str],
        current_row: PolicyRegister | None,
        relaxed_fallbacks: dict[str, int],
    ) -> PopulationCsvNormalizedRow | None:
        member_id = self._population_upload_value(raw_data, "member_id", "pensioner_ref")
        gender = self._normalize_population_upload_gender(self._population_upload_value(raw_data, "gender"))
        if not member_id or gender is None:
            return None

        relaxed_fallbacks["rows_relaxed"] += 1
        date_of_birth = self._parse_population_upload_date(self._population_upload_value(raw_data, "date_of_birth", "dob"))
        if date_of_birth is None:
            if current_row is not None:
                date_of_birth = current_row.date_of_birth
                relaxed_fallbacks["date_of_birth_from_existing"] += 1
            else:
                date_of_birth = RELAXED_POPULATION_UPLOAD_PLACEHOLDER_DOB
                relaxed_fallbacks["date_of_birth_placeholder"] += 1

        annual_pension = self._parse_population_upload_decimal(
            self._population_upload_value(raw_data, "annual_pension", "annuity_amount")
        )
        if annual_pension is None:
            if current_row is not None:
                annual_pension = Decimal(str(current_row.annual_pension or 0))
                relaxed_fallbacks["annual_pension_from_existing"] += 1
            else:
                annual_pension = RELAXED_POPULATION_UPLOAD_PLACEHOLDER_PENSION
                relaxed_fallbacks["annual_pension_placeholder"] += 1

        pension_currency = self._population_upload_value(raw_data, "pension_currency", "currency")
        status = self._population_upload_value(raw_data, "status")
        date_of_death_value = self._population_upload_value(raw_data, "date_of_death", "death_date")
        commencement_date_value = self._population_upload_value(raw_data, "commencement_date")
        effective_from_value = self._population_upload_value(raw_data, "effective_from")
        escalation_rate_value = self._population_upload_value(raw_data, "escalation_rate")

        return PopulationCsvNormalizedRow(
            member_id=member_id,
            policy_id=self._population_upload_value(raw_data, "policy_id") or (current_row.policy_id if current_row else None),
            date_of_birth=date_of_birth,
            gender=gender,
            smoker_status=self._population_upload_value(raw_data, "smoker_status") or (current_row.smoker_status if current_row else None),
            postcode=self._population_upload_value(raw_data, "postcode") or (current_row.postcode if current_row else None),
            annual_pension=annual_pension,
            pension_currency=(
                pension_currency
                or (current_row.pension_currency if current_row and current_row.pension_currency else "GBP")
            ).upper(),
            escalation_type=(
                self._population_upload_value(raw_data, "escalation_type", "indexation_basis")
                or (current_row.escalation_type if current_row else None)
            ),
            escalation_rate=(
                self._parse_population_upload_decimal(escalation_rate_value)
                if escalation_rate_value is not None
                else (Decimal(str(current_row.escalation_rate)) if current_row and current_row.escalation_rate is not None else None)
            ),
            status=(status or (current_row.status if current_row else "active")).lower(),
            date_of_death=(
                self._parse_population_upload_date(date_of_death_value)
                if date_of_death_value is not None
                else (current_row.date_of_death if current_row else None)
            ),
            commencement_date=(
                self._parse_population_upload_date(commencement_date_value)
                if commencement_date_value is not None
                else (current_row.commencement_date if current_row else None)
            ),
            effective_from=self._parse_population_upload_date(effective_from_value),
            verification_reference=self._population_upload_value(raw_data, "verification_reference", "verified_by"),
        )

    def _population_upload_value(self, raw_data: dict[str, str], *aliases: str) -> str | None:
        for alias in aliases:
            value = (raw_data.get(alias) or "").strip()
            if value:
                return value
        return None

    def _normalize_population_upload_gender(self, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().upper()
        if normalized in {"M", "F"}:
            return normalized
        if normalized == "MALE":
            return "M"
        if normalized == "FEMALE":
            return "F"
        return None

    def _parse_population_upload_date(self, value: str | None) -> date | None:
        if value is None:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None

    def _parse_population_upload_decimal(self, value: str | None) -> Decimal | None:
        if value is None:
            return None
        try:
            return Decimal(value.replace(",", ""))
        except InvalidOperation:
            return None

    def _build_contract_upload_message(self, import_summary: dict[str, int], relaxed_fallbacks: dict[str, int]) -> str:
        message = (
            f"Imported {import_summary['created']} new rows, updated {import_summary['updated']} members, "
            f"and left {import_summary['unchanged']} rows unchanged."
        )
        if relaxed_fallbacks["rows_relaxed"] == 0:
            return message
        return (
            f"{message} Accepted {relaxed_fallbacks['rows_relaxed']} row(s) with missing or invalid "
            "date_of_birth/annual_pension by reusing current member values when available and defaulting new members to "
            "1900-01-01 / 0 until the later enrichment phase."
        )

    def _population_rows_match(self, current: PolicyRegister, row: PopulationCsvNormalizedRow) -> bool:
        return (
            current.policy_id == row.policy_id
            and current.date_of_birth == row.date_of_birth
            and current.gender == row.gender
            and current.smoker_status == row.smoker_status
            and current.postcode == row.postcode
            and float(current.annual_pension or 0) == float(row.annual_pension)
            and (current.pension_currency or "GBP") == row.pension_currency
            and current.escalation_type == row.escalation_type
            and self._float_or_none(current.escalation_rate) == self._float_or_none(row.escalation_rate)
            and current.status == row.status
            and current.date_of_death == row.date_of_death
            and current.commencement_date == row.commencement_date
        )

    def _float_or_none(self, value: Any) -> float | None:
        if value is None:
            return None
        return float(value)

    def _generate_contract_members(self, contract: Contract, summary: dict[str, Any]) -> list[dict[str, Any]]:
        total_members = int(summary.get("total_members") or 0)
        active_members = int(summary.get("active_members") or 0)
        deferred_members = int(summary.get("deferred_members") or 0)
        deceased_members = int(summary.get("deceased_members") or 0)
        spouse_members = int(summary.get("spouse_members") or 0)
        status_sequence = (
            ["active"] * active_members
            + ["deferred"] * deferred_members
            + ["deceased"] * deceased_members
            + ["active"] * max(total_members - active_members - deferred_members - deceased_members, 0)
        )[:total_members]

        base_number = 1000000 + sum(ord(character) for character in contract.contract_id)
        currency = summary.get("currency") or contract.currency or "USD"
        records = []
        for index in range(total_members):
            member_number = base_number + index * 2
            status = status_sequence[index] if index < len(status_sequence) else "active"
            member_type = "spouse" if index < spouse_members else "pensioner"
            age = 62 + (index % 27)
            annuity_amount = 12000 + (index * 387)
            records.append(
                {
                    "member_id": f"PEN-{member_number:07d}",
                    "name": f"{'Spouse' if member_type == 'spouse' else 'Member'} {index + 1:03d}",
                    "age": age,
                    "gender": "F" if index % 2 == 0 else "M",
                    "annuity_amount": annuity_amount,
                    "currency": currency,
                    "status": status,
                    "last_verified": summary.get("last_verified_date") or "2025-03-31",
                    "defer_reason": "Benefit verification hold" if status == "deferred" else "",
                }
            )
        return records

    def _default_contract_store(self, contract: Contract, cedent_name: str) -> dict[str, Any]:
        currency = contract.currency or "USD"
        notional = float(contract.notional_amount or 0)
        lives_count = contract.lives_count or 0
        fixed_leg_rate_pct = round(float(contract.fixed_leg_rate or 0) * 100, 2)
        renewal_date = self._next_year_same_day(contract.inception_date).isoformat() if contract.inception_date else ""
        renewal_offset_days = (
            (self._next_year_same_day(contract.inception_date) - date.today()).days if contract.inception_date else 0
        )
        economic_locked = bool(contract.inception_date and contract.inception_date <= date.today() and contract.status == "active")
        summary_member_total = 60 if lives_count else 0
        summary_active = max(summary_member_total - 7, 0)
        summary_deferred = 5 if summary_member_total else 0
        summary_deceased = 2 if summary_member_total else 0
        summary_spouse = 3 if summary_member_total else 0
        quarter_seed = contract.inception_date.year if contract.inception_date else date.today().year
        fixed_leg_amount = round((notional * max(float(contract.fixed_leg_rate or 0), 0.01)) / 4, 2) if notional else 0
        settlement_history = [
            {
                "period": f"Q1 {quarter_seed}",
                "expected_deaths": 210,
                "actual_deaths": 214,
                "ae_ratio": 1.019,
                "fixed_leg": fixed_leg_amount,
                "floating_leg": round(fixed_leg_amount * 1.012, 2),
                "net_settled": round(fixed_leg_amount * 0.012, 2),
                "active_pensioners": max(lives_count - 41, 0),
                "status": "paid",
            },
            {
                "period": f"Q2 {quarter_seed}",
                "expected_deaths": 210,
                "actual_deaths": 208,
                "ae_ratio": 0.99,
                "fixed_leg": fixed_leg_amount,
                "floating_leg": round(fixed_leg_amount * 0.994, 2),
                "net_settled": round(fixed_leg_amount * -0.006, 2),
                "active_pensioners": max(lives_count - 88, 0),
                "status": "paid",
            },
            {
                "period": f"Q3 {quarter_seed}",
                "expected_deaths": 210,
                "actual_deaths": 212,
                "ae_ratio": 1.01,
                "fixed_leg": fixed_leg_amount,
                "floating_leg": round(fixed_leg_amount * 1.004, 2),
                "net_settled": round(fixed_leg_amount * 0.004, 2),
                "active_pensioners": max(lives_count - 129, 0),
                "status": "paid",
            },
            {
                "period": f"Q4 {quarter_seed}",
                "expected_deaths": 210,
                "actual_deaths": 207,
                "ae_ratio": 0.986,
                "fixed_leg": fixed_leg_amount,
                "floating_leg": round(fixed_leg_amount * 0.992, 2),
                "net_settled": round(fixed_leg_amount * -0.008, 2),
                "active_pensioners": max(lives_count - 165, 0),
                "status": "paid",
            },
            {
                "period": f"Q1 {quarter_seed + 1}",
                "expected_deaths": 210,
                "actual_deaths": 211,
                "ae_ratio": 1.005,
                "fixed_leg": fixed_leg_amount,
                "floating_leg": round(fixed_leg_amount * 1.002, 2),
                "net_settled": round(fixed_leg_amount * 0.002, 2),
                "active_pensioners": max(lives_count - 201, 0),
                "status": "paid",
            },
        ]

        return {
            "renewal_date": renewal_date,
            "master_data": {
                "contract_id": contract.contract_id,
                "contract_name": contract.contract_name,
                "contract_version": contract.contract_version or "v1.0",
                "cedent_id": contract.cedent_id or "",
                "cedent_name": cedent_name,
                "counterparty_role": contract.counterparty_role or "Reinsurer",
                "parent_contract_id": "",
                "swap_type": contract.swap_type or "Indemnity",
                "structure": contract.structure or "Single tranche",
                "master_agreement_reference": contract.master_agreement_ref or "",
                "inception_date": contract.inception_date.isoformat() if contract.inception_date else "",
                "effective_date": contract.effective_date.isoformat() if contract.effective_date else "",
                "maturity_date": contract.maturity_date.isoformat() if contract.maturity_date else "",
                "duration_years": contract.duration_years or "",
                "governing_law": contract.governing_law or "English Law",
                "jurisdiction": contract.jurisdiction or "England & Wales",
                "status": contract.status,
            },
            "economic_terms": {
                "notional_amount": notional,
                "currency": currency,
                "settlement_currency": currency,
                "fixed_leg_rate_pct": fixed_leg_rate_pct,
                "fixed_leg_basis": "ACT/365",
                "fixed_leg_frequency": contract.fixed_leg_frequency or "Quarterly",
                "floating_leg_definition": contract.floating_leg_definition or "Realized mortality",
                "floating_leg_index_table": contract.floating_leg_index or "CMI 2024 SAPS",
                "floating_leg_frequency": "Quarterly",
                "payment_lag_days": 30,
                "fx_reference_source": "Bloomberg WMR 4pm",
                "collateral_required": True,
                "collateral_threshold": round(notional * 0.02, 2) if notional else 0,
                "independent_amount": "",
                "is_locked": economic_locked,
            },
            "reference_pool": {
                "pool_name": f"{cedent_name} Reference Pool",
                "lives_covered": lives_count,
                "average_age": 71 if lives_count else 0,
                "male_female_split": "55/45" if lives_count else "",
                "average_pension_amount": 24500 if lives_count else 0,
                "pool_currency": currency,
                "geographic_concentration": "Primary domicile concentration",
                "benefit_type": "Defined Benefit",
                "indexation_basis": "CPI capped 5%",
                "closed_open": "Closed",
                "data_as_of": contract.inception_date.isoformat() if contract.inception_date else "",
                "data_source_reference": "",
            },
            "actuarial_basis": {
                "mortality_table_id": "CMI-2024-M",
                "mortality_table_name": "CMI 2024 with 1.5% LTR",
                "mortality_improvement_scale": "",
                "discount_curve_id": f"YC-{currency}",
                "discount_curve_source": "Bloomberg",
                "inflation_assumption": "CPI 2.4%",
                "longevity_loading_pct": 1.5,
                "expense_loading_pct": 0.4,
                "assumption_set_id": f"AS-{contract.contract_id}",
                "last_revaluation": renewal_date or "",
                "next_revaluation_due": self._next_year_same_day(self._next_year_same_day(contract.inception_date)).isoformat()
                if contract.inception_date
                else "",
            },
            "risk_limits": {
                "max_loss_limit": round(notional * 0.15, 2) if notional else 0,
                "aggregate_limit": round(notional * 0.3, 2) if notional else 0,
                "deductible": round(notional * 0.005, 2) if notional else 0,
                "catastrophe_cap": round(notional * 0.2, 2) if notional else 0,
                "rating_downgrade_trigger": "< A-",
                "risk_committee_approval_required": True,
                "early_termination_event": "",
                "novation_rights": "",
                "cedant_change_of_control": "",
            },
            "operational_terms": {
                "settlement_calendar": "London",
                "cession_file_format": "CSV",
                "cession_file_frequency": "Quarterly",
                "sftp_endpoint_id": f"sftp-{contract.contract_id.lower()}",
                "encryption_method": "PGP",
                "reporting_package": "Standard quarterly pack",
                "lead_underwriter": "m.patel@reinsure.io",
                "operations_contact": "a.chen@reinsure.io",
                "legal_contact": "legal@reinsure.io",
            },
            "compliance_docs": [
                {
                    "doc_type": "ISDA",
                    "doc_name": f"{contract.contract_id} Master Agreement",
                    "doc_date": contract.inception_date.isoformat() if contract.inception_date else "",
                    "status": "approved",
                    "file_name": f"{contract.contract_id.lower()}-isda.pdf",
                },
                {
                    "doc_type": "KYC",
                    "doc_name": f"{cedent_name} KYC Package",
                    "doc_date": "2025-03-15",
                    "status": "approved",
                    "file_name": f"{(contract.cedent_id or 'cedent').lower()}-kyc.zip",
                },
            ],
            "audit_approval": [
                {
                    "timestamp": "2026-05-05 10:30:00",
                    "actor": "IRiS Bootstrap",
                    "action": "Seeded contract profile",
                    "detail": "Default contract detail prepared",
                }
            ],
            "details_performance": {
                "contract_id": contract.contract_id,
                "current_notional": notional,
                "lives_active": max(lives_count - 201, 0),
                "lives_deceased_ytd": 201 if lives_count else 0,
                "ae_ratio_ytd": 1.005,
                "bel": round(notional * 0.72, 2) if notional else 0,
                "mtm": round(notional * 0.018, 2) if notional else 0,
                "renewal_offset_days": renewal_offset_days,
                "headline_metrics": [
                    {"label": "Notional", "value": self._format_currency_display(notional, currency), "accent": "default"},
                    {
                        "label": "Fixed Leg",
                        "value": f"{fixed_leg_rate_pct:.2f}% {contract.fixed_leg_frequency or 'Quarterly'}",
                        "accent": "default",
                    },
                    {"label": "Lives Covered", "value": f"{lives_count:,}", "accent": "default"},
                    {
                        "label": "Renewal Date",
                        "value": renewal_date,
                        "subtitle": f"{renewal_offset_days:+d} days",
                        "accent": "danger" if renewal_offset_days < 0 else "default",
                    },
                    {"label": "A/E Mortality", "value": "100.5%", "subtitle": "201 / 200 deaths", "accent": "default"},
                ],
                "summary_cards": [
                    {
                        "title": "Identification",
                        "items": [
                            {"label": "Contract ID", "value": contract.contract_id},
                            {"label": "Cedant", "value": f"{contract.cedent_id} - {cedent_name}"},
                            {"label": "Swap Type", "value": contract.swap_type or "Indemnity"},
                            {"label": "Structure", "value": contract.structure or "Single tranche"},
                            {"label": "Inception", "value": contract.inception_date.isoformat() if contract.inception_date else "-"},
                            {"label": "Maturity", "value": contract.maturity_date.isoformat() if contract.maturity_date else "-"},
                            {"label": "Duration", "value": f"{contract.duration_years or 0} yrs"},
                            {"label": "Version", "value": contract.contract_version or "v1.0"},
                            {"label": "Governing Law", "value": contract.governing_law or "English Law"},
                        ],
                    },
                    {
                        "title": "Economic Terms",
                        "items": [
                            {"label": "Notional", "value": self._format_currency_display(notional, currency)},
                            {"label": "Fixed Leg", "value": f"{fixed_leg_rate_pct:.2f}% ACT/365"},
                            {"label": "Floating Leg", "value": contract.floating_leg_definition or "Realized mortality"},
                            {"label": "Payment Lag", "value": "30 days"},
                            {"label": "Settlement Ccy", "value": currency},
                            {
                                "label": "Collateral",
                                "value": f"Threshold {self._format_currency_display(round(notional * 0.02, 2), currency)}",
                            },
                        ],
                    },
                    {
                        "title": "Reference Pool",
                        "items": [
                            {"label": "Pool Name", "value": f"{cedent_name} Reference Pool"},
                            {"label": "Lives", "value": f"{lives_count:,}"},
                            {"label": "Avg Age", "value": "71"},
                            {"label": "M/F Split", "value": "55/45"},
                            {"label": "Avg Pension", "value": self._format_currency_display(24500, currency)},
                            {"label": "Indexation", "value": "CPI capped 5%"},
                            {"label": "Status", "value": "Closed"},
                        ],
                    },
                    {
                        "title": "Actuarial Basis",
                        "items": [
                            {"label": "Mortality Table", "value": "CMI 2024 with 1.5% LTR"},
                            {"label": "Improvement Scale", "value": "-"},
                            {"label": "Discount Curve", "value": f"YC-{currency} (Bloomberg)"},
                            {"label": "Inflation", "value": "CPI 2.4%"},
                            {"label": "Longevity Loading", "value": "1.5%"},
                            {"label": "Last Reval", "value": renewal_date or "-"},
                            {
                                "label": "Next Reval",
                                "value": self._next_year_same_day(self._next_year_same_day(contract.inception_date)).isoformat()
                                if contract.inception_date
                                else "-",
                            },
                        ],
                    },
                    {
                        "title": "Risk & Limits",
                        "items": [
                            {"label": "Max Loss", "value": self._format_currency_display(round(notional * 0.15, 2), currency)},
                            {"label": "Aggregate", "value": self._format_currency_display(round(notional * 0.3, 2), currency)},
                            {"label": "Deductible", "value": self._format_currency_display(round(notional * 0.005, 2), currency)},
                            {"label": "Cat Cap", "value": self._format_currency_display(round(notional * 0.2, 2), currency)},
                        ],
                    },
                    {
                        "title": "Operational",
                        "items": [
                            {"label": "SFTP", "value": f"sftp-{contract.contract_id.lower()}"},
                            {"label": "Format", "value": "CSV"},
                            {"label": "Frequency", "value": "Quarterly"},
                            {"label": "Calendar", "value": "London"},
                            {"label": "Underwriter", "value": "m.patel@reinsure.io"},
                            {"label": "Operations", "value": "a.chen@reinsure.io"},
                        ],
                    },
                ],
                "cumulative_net_variance": round(sum(row["net_settled"] for row in settlement_history), 2),
                "settlement_history": settlement_history,
            },
            "file_templates": [
                {
                    "id": "T1",
                    "file_type": "Pensioner Parameters",
                    "template_name": f"{contract.contract_id}-T1",
                    "schema_version": "v2.1",
                    "format": "CSV",
                    "frequency": "Quarterly",
                    "channel": f"sftp-{contract.contract_id.lower()}",
                    "last_received": "2025-03-31",
                    "required_columns": [
                        "member_id",
                        "dob",
                        "gender",
                        "annuity_amount",
                        "currency",
                        "status",
                        "last_payment_date",
                        "indexation_basis",
                    ],
                    "is_active": True,
                },
                {
                    "id": "T2",
                    "file_type": "Spouse / Beneficiary Events",
                    "template_name": f"{contract.contract_id}-T2",
                    "schema_version": "v1.4",
                    "format": "CSV",
                    "frequency": "Monthly",
                    "channel": f"sftp-{contract.contract_id.lower()}",
                    "last_received": "2025-03-31",
                    "required_columns": ["member_id", "event_type", "event_date", "spouse_dob", "spouse_gender", "benefit_pct"],
                    "is_active": True,
                },
                {
                    "id": "T3",
                    "file_type": "Fixed Fee Amounts",
                    "template_name": f"{contract.contract_id}-T3",
                    "schema_version": "v1.0",
                    "format": "XLSX",
                    "frequency": "Quarterly",
                    "channel": f"sftp-{contract.contract_id.lower()}",
                    "last_received": "2025-03-31",
                    "required_columns": ["period", "fee_amount", "currency", "due_date"],
                    "is_active": True,
                },
                {
                    "id": "T4",
                    "file_type": "Fixed Leg Schedule",
                    "template_name": f"{contract.contract_id}-T4",
                    "schema_version": "v1.2",
                    "format": "CSV",
                    "frequency": "Quarterly",
                    "channel": f"sftp-{contract.contract_id.lower()}",
                    "last_received": "2025-03-31",
                    "required_columns": ["payment_date", "notional", "rate", "amount", "currency"],
                    "is_active": True,
                },
                {
                    "id": "T5",
                    "file_type": "Settlement",
                    "template_name": f"{contract.contract_id}-T5",
                    "schema_version": "v1.0",
                    "format": "CSV",
                    "frequency": "Quarterly",
                    "channel": f"sftp-{contract.contract_id.lower()}",
                    "last_received": "2025-03-31",
                    "required_columns": [
                        "Calculation Period",
                        "Payment Date",
                        "Pensioner Movement",
                        "Applicable Indexation/Escalation",
                        "Fixed Leg",
                        "Floating Leg",
                        "Fee",
                        "Interest on Over/Underpayment from Prior Period",
                        "Net Settlement Amount",
                    ],
                    "is_active": True,
                },
                {
                    "id": "T6",
                    "file_type": "Demographic Assumptions",
                    "template_name": f"{contract.contract_id}-T6",
                    "schema_version": "v3.0",
                    "format": "XLSX",
                    "frequency": "Annual",
                    "channel": f"sftp-{contract.contract_id.lower()}",
                    "last_received": "2025-03-31",
                    "required_columns": ["age", "gender", "qx", "improvement_rate", "ltr"],
                    "is_active": True,
                },
                {
                    "id": "T7",
                    "file_type": "Mortality Experience",
                    "template_name": f"{contract.contract_id}-T7",
                    "schema_version": "v2.0",
                    "format": "CSV",
                    "frequency": "Quarterly",
                    "channel": f"sftp-{contract.contract_id.lower()}",
                    "last_received": "2025-03-31",
                    "required_columns": ["member_id", "death_date", "cause_code", "verified_by", "verified_date"],
                    "is_active": True,
                },
            ],
            "amendments": [],
            "audit_compliance": {
                "checklist": [
                    {"control": "Contract approval memo", "status": "complete", "owner": "Underwriting", "due_date": "2025-03-15", "notes": "Signed off"},
                    {"control": "Legal documentation", "status": "complete", "owner": "Legal", "due_date": "2025-03-15", "notes": "ISDA on file"},
                    {"control": "Sanctions refresh", "status": "monitoring", "owner": "Compliance", "due_date": "2026-03-15", "notes": "Periodic schedule active"},
                    {"control": "Operational certification", "status": "complete", "owner": "Claims Ops", "due_date": "2025-03-20", "notes": "Templates confirmed"},
                ],
                "audit_trail": [
                    {
                        "timestamp": "2026-05-05 01:12:48",
                        "actor": "SFTP Listener",
                        "type": "System",
                        "action": "File received via SFTP",
                        "detail": "-",
                    },
                    {
                        "timestamp": "2026-05-05 01:12:48",
                        "actor": "AI Classifier v3.2",
                        "type": "AI Agent",
                        "action": "Classified settlement support file",
                        "detail": "confidence 94%",
                    },
                    {
                        "timestamp": "2026-05-05 01:12:48",
                        "actor": "Pipeline Orchestrator",
                        "type": "System",
                        "action": f"Mapped to {contract.contract_id} {contract.contract_version or 'v1.0'}",
                        "detail": "-",
                    },
                ],
            },
            "member_population": {
                "total_members": summary_member_total,
                "active_members": summary_active,
                "deferred_members": summary_deferred,
                "spouse_members": summary_spouse,
                "deceased_members": summary_deceased,
                "currency": currency,
                "last_verified_date": "2025-03-31",
            },
        }

    def _increment_version(self, version: str, amendment_number: int) -> str:
        parts = version.lstrip("v").split(".")
        if len(parts) == 2 and parts[1].isdigit():
            return f"v{parts[0]}.{int(parts[1]) + 1}"
        return f"v1.{amendment_number}"

    def _next_year_same_day(self, value: date | None) -> date:
        if value is None:
            return date.today()
        try:
            return value.replace(year=value.year + 1)
        except ValueError:
            return value.replace(month=2, day=28, year=value.year + 1)

    def _slice_quarter_range(self, rows: list[dict[str, Any]], from_period: str, to_period: str) -> list[dict[str, Any]]:
        labels = [row["period"] for row in rows]
        if from_period not in labels or to_period not in labels:
            return rows
        start_index = labels.index(from_period)
        end_index = labels.index(to_period)
        if end_index < start_index:
            start_index, end_index = end_index, start_index
        return rows[start_index : end_index + 1]

    def _group_calculation_rows(
        self,
        rows: list[dict[str, Any]],
        metric: str,
        aggregation: str,
        group_by: str,
    ) -> list[dict[str, Any]]:
        if group_by == "per_quarter":
            return [{"period": row["period"], "value": self._metric_value_for_row(metric, row)} for row in rows]

        grouped: dict[str, list[float]] = {}
        if group_by == "per_year":
            for row in rows:
                year = row["period"].split(" ")[-1]
                grouped.setdefault(year, []).append(self._metric_value_for_row(metric, row))
            return [{"period": year, "value": self._aggregate_values(values, aggregation)} for year, values in grouped.items()]

        values = [self._metric_value_for_row(metric, row) for row in rows]
        return [{"period": "Total", "value": self._aggregate_values(values, aggregation)}]

    def _enrich_contract_performance(
        self,
        detail: dict[str, Any],
        contract: Contract,
        cedent_name: str,
    ) -> dict[str, Any]:
        performance = deepcopy(detail["details_performance"])
        settlement_history = performance.get("settlement_history", [])
        currency = contract.currency or detail["economic_terms"]["currency"]
        performance["overview_metrics"] = self._build_contract_overview_metrics(contract, settlement_history, currency)
        performance["operational_trace"] = self._build_contract_operational_trace(detail)
        performance["vitality_indices"] = self._build_contract_vitality_indices(detail, settlement_history)
        performance["decision_intelligence"] = self._build_contract_decision_intelligence(contract, detail, settlement_history, cedent_name)
        performance["technical_vault"] = self._build_contract_technical_vault(contract, detail)
        return performance

    def _build_contract_overview_metrics(
        self,
        contract: Contract,
        settlement_history: list[dict[str, Any]],
        currency: str,
    ) -> list[dict[str, Any]]:
        latest_row = settlement_history[-1] if settlement_history else None
        latest_net = float(latest_row["net_settled"]) if latest_row else 0.0
        latest_ae = float(latest_row["ae_ratio"]) if latest_row else 1.0
        exposure_value = round(float(contract.notional_amount or 0) * 0.036, 2)
        exposure_change = round((latest_ae - 1) * 100, 1)
        return [
            {
                "label": "Aggregate Exposure",
                "value": self._format_currency_display(exposure_value, currency),
                "change": f"{exposure_change:+.1f}%",
                "tone": "warning" if abs(exposure_change) >= 2 else "positive",
            },
            {
                "label": "Latest Net Payout",
                "value": self._format_signed_currency_display(latest_net, currency),
                "tone": "positive" if latest_net >= 0 else "negative",
            },
            {
                "label": "A/E Variance L30D",
                "value": f"{((latest_ae - 1) * 100):+.1f}%",
                "tone": "warning" if latest_ae > 1.015 else "positive",
            },
            {
                "label": "Next Settlement",
                "value": "2026-06-30",
                "tone": "default",
            },
        ]

    def _build_contract_operational_trace(self, detail: dict[str, Any]) -> list[dict[str, Any]]:
        events = detail.get("audit_compliance", {}).get("audit_trail", [])
        trace_items: list[dict[str, Any]] = []
        for event in events[:4]:
            trace_items.append(
                {
                    "timestamp": event["timestamp"],
                    "title": event["action"],
                    "description": event["detail"],
                    "actor": event["actor"],
                    "status": event["type"].lower().replace(" ", "_"),
                }
            )
        return trace_items

    def _build_contract_vitality_indices(
        self,
        detail: dict[str, Any],
        settlement_history: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        latest_row = settlement_history[-1] if settlement_history else None
        latest_ae = float(latest_row["ae_ratio"]) if latest_row else 1.0
        template_count = len(detail.get("file_templates", []))
        renewal_offset_days = int(detail["details_performance"].get("renewal_offset_days", 0))
        return [
            {
                "label": "Trend Stability",
                "value": "Stable" if abs(latest_ae - 1) < 0.03 else "Watch",
                "caption": f"A/E {latest_ae:.3f} versus trailing quarter.",
                "tone": "positive" if abs(latest_ae - 1) < 0.03 else "warning",
            },
            {
                "label": "Ingestion Integrity",
                "value": "99.2%",
                "caption": f"{template_count} active file templates synchronized.",
                "tone": "positive",
            },
            {
                "label": "SLA Performance",
                "value": "At Risk" if renewal_offset_days < 0 else "On Track",
                "caption": "Quarterly servicing controls monitored through IRiS.",
                "tone": "warning" if renewal_offset_days < 0 else "positive",
            },
        ]

    def _build_contract_decision_intelligence(
        self,
        contract: Contract,
        detail: dict[str, Any],
        settlement_history: list[dict[str, Any]],
        cedent_name: str,
    ) -> dict[str, Any]:
        latest_row = settlement_history[-1] if settlement_history else None
        latest_net = float(latest_row["net_settled"]) if latest_row else 0.0
        latest_ae = float(latest_row["ae_ratio"]) if latest_row else 1.0
        stance = "within tolerance" if abs(latest_ae - 1) < 0.03 else "outside tolerance"
        return {
            "headline": f"{contract.contract_id} remains {stance} with a monitored payout profile.",
            "insight": (
                f"IRiS expects {cedent_name} to remain operationally stable through the next settlement cycle. "
                f"The latest payout of {self._format_signed_currency_display(latest_net, contract.currency or 'USD')} "
                f"and A/E ratio of {latest_ae:.3f} do not currently breach the configured rule set."
            ),
            "supporting_points": [
                "Recent operational trace shows successful file ingestion and contract mapping.",
                "Vitality indices indicate the current servicing pattern is stable but requires SLA watch.",
                f"Active compliance checklist items: {len(detail.get('audit_compliance', {}).get('checklist', []))}.",
            ],
        }

    def _build_contract_technical_vault(self, contract: Contract, detail: dict[str, Any]) -> list[dict[str, Any]]:
        first_doc = next(iter(detail.get("compliance_docs", [])), None)
        first_event = next(iter(detail.get("audit_compliance", {}).get("audit_trail", [])), None)
        cedent_name = detail.get("master_data", {}).get("cedent_name", "Unmapped Cedant")
        return [
            {
                "label": "Source Registry Logs",
                "value": first_event["action"] if first_event else "No source registry events logged",
                "kind": "log",
            },
            {
                "label": "Master Treaty PDF",
                "value": first_doc["file_name"] if first_doc else f"{contract.contract_id.lower()}-treaty.pdf",
                "kind": "document",
            },
            {
                "label": "Counterparty Node",
                "value": f"{contract.contract_id} - {cedent_name}",
                "kind": "node",
            },
        ]

    def _metric_value_for_row(self, metric: str, row: dict[str, Any]) -> float:
        if metric == "fixed_leg_total":
            return float(row["fixed_leg"])
        if metric == "floating_leg_total":
            return float(row["floating_leg"])
        if metric == "ae_ratio":
            return float(row["ae_ratio"])
        return float(row["net_settled"])

    def _aggregate_values(self, values: list[float], aggregation: str) -> float:
        if not values:
            return 0.0
        if aggregation == "avg":
            return round(sum(values) / len(values), 3)
        if aggregation == "min":
            return round(min(values), 3)
        if aggregation == "max":
            return round(max(values), 3)
        return round(sum(values), 3)

    def _format_currency_display(self, amount: float, currency: str) -> str:
        symbol = {"GBP": "£", "USD": "$", "EUR": "€", "CHF": "CHF ", "CAD": "CAD "}.get(currency, f"{currency} ")
        return f"{symbol}{amount:,.0f}"

    def _format_signed_currency_display(self, amount: float, currency: str) -> str:
        sign = "+" if amount >= 0 else "-"
        return f"{sign}{self._format_currency_display(abs(amount), currency)}"

    def _default_currency(self, country: str) -> str:
        return {
            "UK": "GBP",
            "CH": "CHF",
            "US": "USD",
            "CA": "CAD",
            "DE": "EUR",
        }.get(country, "USD")

    def _format_billions(self, amount: Any, currency: str) -> str:
        numeric_value = float(amount or 0)
        symbol = "$" if currency == "USD" else f"{currency} "
        if numeric_value >= 1_000_000_000:
            return f"{symbol}{numeric_value / 1_000_000_000:.1f}B"
        if numeric_value >= 1_000_000:
            return f"{symbol}{numeric_value / 1_000_000:.1f}M"
        return f"{symbol}{numeric_value:,.0f}"
