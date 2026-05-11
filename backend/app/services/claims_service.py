from __future__ import annotations

import csv
import io
import json
import logging
import re
import uuid
from collections import Counter
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import BackgroundTasks, UploadFile

from config import OPENAI_MODEL, openai_client
from app.errors import IrisAPIError
from app.mock_data_loader import load_mock_data
from app.models.audit_event import AuditEvent
from app.models.cession_file import CessionFile
from app.models.cession_file_exception import CessionFileException
from app.models.cession_file_record import CessionFileRecord
from app.models.contract import Contract
from app.models.population import PolicyRegister
from app.models.settlement import Settlement
from app.models.worklist import WorklistItem
from app.repositories.claims_repository import ClaimsRepository
from app.services.population_csv import (
    ALLOWED_POPULATION_STATUSES,
    PopulationCsvIssue,
    PopulationCsvNormalizedRow,
    extract_tabular_upload_text,
)
from app.services.settlement_report_files import generate_settlement_report_files


logger = logging.getLogger(__name__)
UTC = timezone.utc

PIPELINE_OVERRIDES_FILE = Path(__file__).resolve().parent.parent / "mock_data" / "cession_pipeline_overrides.json"
SETTLEMENT_OVERRIDES_FILE = Path(__file__).resolve().parent.parent / "mock_data" / "settlement_overrides.json"
CREATED_SETTLEMENTS_KEY = "__created_rows__"
SETTLEMENT_EXPECTED_FALLBACKS_KEY = "__settlement_expected_fallbacks__"

PIPELINE_STEPS = [
    "upload",
    "detect",
    "map-contract",
    "clauses",
    "validate",
    "exceptions",
    "process",
    "summary",
    "worklist",
    "audit",
]

FILE_TYPE_OPTIONS = [
    "Pension Status",
    "Settlement",
    "Fixed Leg",
    "Mortality Report",
    "Spouse Events",
    "Activity Report",
    "Fee Schedule",
]

LIST_METRICS_BASELINE = {
    "in_pipeline": 6,
    "exceptions": 4,
    "processed": 2,
    "stp_pct": 94.2,
    "pipeline_throughput": {
        "records_ingested": 18976,
        "files": 7,
        "in_exception": 4,
        "avg_processing_time": "2h 14m",
    },
}

SUPPORTED_CALCULATION_TYPES = {"settlement", "fixed_leg", "floating_leg", "ae_ratio"}
DETECTION_AI_CONFIDENCE_THRESHOLD = 0.75
PENSION_STATUS_ALLOWED_STATUSES = {"active", "deceased", "deferred"}

REQUIRED_FIELDS_BY_FILE_TYPE = {
    "Pension Status": ["member_id", "date_of_birth", "gender", "annual_pension", "status"],
    "Settlement": [
        "calculation_period",
        "payment_date",
        "pensioner_movement",
        "applicable_indexation_escalation",
        "fixed_leg",
        "floating_leg",
        "fee",
        "interest_prior_period",
        "net_settlement_amount",
    ],
    "Fixed Leg": ["period", "fixed_leg_amount", "currency"],
    "Mortality Report": ["member_id", "death_date"],
    "Spouse Events": ["member_id", "event_type", "event_date"],
    "Activity Report": ["member_id", "activity_code", "effective_date"],
    "Fee Schedule": ["period", "fee_amount", "currency"],
}

OPTIONAL_FIELDS_BY_FILE_TYPE = {
    "Pension Status": [
        "policy_id",
        "smoker_status",
        "postcode",
        "pension_currency",
        "escalation_type",
        "escalation_rate",
        "date_of_death",
        "commencement_date",
        "effective_from",
        "verification_reference",
    ],
    "Settlement": ["contract_id", "currency"],
    "Fixed Leg": ["fee_amount", "value_date", "contract_id"],
    "Mortality Report": ["cause_code", "verified_by"],
    "Spouse Events": ["spouse_dob", "spouse_gender", "benefit_pct"],
    "Activity Report": ["contract_id"],
    "Fee Schedule": ["due_date", "contract_id"],
}

COLUMN_ALIASES_BY_FIELD = {
    "member_id": ("member_id", "memberid", "pensioner_ref", "pensioner_id", "participant_id", "life_id"),
    "policy_id": ("policy_id", "policy_number", "policy_ref"),
    "date_of_birth": ("date_of_birth", "dob", "birth_date", "member_dob"),
    "gender": ("gender", "sex"),
    "smoker_status": ("smoker_status", "smoker", "smoking_status"),
    "postcode": ("postcode", "postal_code", "zip"),
    "annual_pension": ("annual_pension", "annuity_amount", "pension_amount", "annual_benefit"),
    "pension_currency": ("pension_currency", "currency", "ccy"),
    "escalation_type": ("escalation_type", "indexation_basis", "indexation"),
    "escalation_rate": ("escalation_rate", "indexation_rate"),
    "status": ("status", "member_status", "pension_status"),
    "date_of_death": ("date_of_death", "death_date", "dod"),
    "commencement_date": ("commencement_date", "pension_start_date"),
    "effective_from": ("effective_from", "effective_date", "movement_date"),
    "verification_reference": ("verification_reference", "verified_by", "evidence_ref"),
    "period": ("period", "quarter", "reporting_period"),
    "fixed_leg_amount": ("fixed_leg_amount", "fixed_amount"),
    "calculation_period": ("calculation_period", "settlement_period", "period", "quarter", "reporting_period"),
    "payment_date": ("payment_date", "value_date", "settlement_date"),
    "pensioner_movement": ("pensioner_movement", "pensioner_movement_e.g._death_suspension_reinstatement", "movement", "movement_type"),
    "applicable_indexation_escalation": (
        "applicable_indexation_escalation",
        "applicable_indexation/escalation",
        "applicable_indexation_/_escalation",
        "applicable_indexation___escalation",
        "indexation_escalation",
        "escalation_tranche",
        "indexation_tranche",
    ),
    "fixed_leg": ("fixed_leg", "fixed_leg_amount", "fixed_amount", "fixed_leg_value"),
    "floating_leg": ("floating_leg", "floating_leg_amount", "floating_amount", "floating_leg_value"),
    "fee": ("fee", "fee_admin", "fee_amount", "admin_fee", "quarterly_fee"),
    "interest_prior_period": (
        "interest_on_over_underpayment_from_prior_period",
        "interest_on_over/underpayment_from_prior_period",
        "interest_prior_period",
        "prior_period_interest",
    ),
    "net_settlement_amount": ("net_settlement_amount", "net_amount", "net_settlement", "settlement_amount"),
    "fee_amount": ("fee_amount", "fee"),
    "value_date": ("value_date", "payment_date"),
    "contract_id": ("contract_id", "contract"),
    "death_date": ("death_date", "date_of_death", "dod"),
    "cause_code": ("cause_code", "cause"),
    "verified_by": ("verified_by", "verification_reference"),
    "event_type": ("event_type", "event"),
    "event_date": ("event_date", "effective_date"),
    "spouse_dob": ("spouse_dob", "beneficiary_dob"),
    "spouse_gender": ("spouse_gender", "beneficiary_gender"),
    "benefit_pct": ("benefit_pct", "benefit_percentage"),
    "activity_code": ("activity_code", "activity"),
    "effective_date": ("effective_date", "effective_from"),
    "fee_amount": ("fee_amount", "quarterly_fee"),
    "due_date": ("due_date", "payment_due"),
}

FILE_PROCESSING_RULES = {
    "Pension Status": [
        "Detect cedent, file type, contract, and period before creating records.",
        "Validate uploaded member rows against current policy_register rows for the confirmed contract.",
        "Require member_id, date_of_birth, gender, annual_pension, and status.",
        "Allow only active, deferred, or deceased statuses for pension-status movement files.",
        "Require every current active member for the contract to be present in the upload.",
        "Process by applying SCD2 policy_register updates and creating a settlement approval worklist item.",
    ],
    "Fixed Leg": [
        "Detect and map before validating.",
        "Validate uploaded fixed-leg amounts against contract economic terms from the contracts table.",
        "Process by calculating fixed/floating/net settlement values and routing settlement approval.",
    ],
    "Settlement": [
        "Detect only when all required settlement headers are present.",
        "Map by cedant and contract before reconciling uploaded fixed, floating, fee, interest, and net amounts.",
        "Use exact cent-level matching against IRiS expected fixed/floating/net values.",
        "Keep data-validation exceptions limited to missing or invalid settlement file values.",
        "Route reconciliation mismatches to the settlement summary and Claims Ops worklist instead of validation exceptions.",
        "Recommend approval only when uploaded settlement amounts exactly match system values.",
        "Keep final settlement approval in the existing human approval workflow.",
    ],
    "Mortality Report": [
        "Detect and map before validating.",
        "Validate mortality events against current policy_register members.",
        "Process confirmed death movements through the same SCD2 population path when implemented.",
    ],
    "Spouse Events": [
        "Detect and map before validating.",
        "Validate beneficiary events against the confirmed contract population.",
        "Route unsupported or incomplete events to Claims Ops review.",
    ],
    "Activity Report": [
        "Detect and map before validating.",
        "Validate activity codes against the confirmed contract population.",
        "Route unsupported transitions to Claims Ops review.",
    ],
    "Fee Schedule": [
        "Detect and map before validating.",
        "Validate fees against contract economic terms.",
        "Route settlement-impacting differences to Claims Ops review.",
    ],
}

SETTLEMENT_TARGET_HEADER_LABELS = {
    "calculation_period": "Calculation Period",
    "payment_date": "Payment Date",
    "pensioner_movement": "Pensioner Movement",
    "applicable_indexation_escalation": "Applicable Indexation / Escalation",
    "fixed_leg": "Fixed Leg",
    "floating_leg": "Floating Leg",
    "fee": "Fee (Admin)",
    "interest_prior_period": "Interest on Over/Underpayment from Prior Period",
    "net_settlement_amount": "Net Settlement Amount",
}


class ClaimsService:
    def __init__(self, repository: ClaimsRepository) -> None:
        self.repository = repository

    def list_cession_files(
        self,
        status: str,
        file_type: str | None,
        cedent_id: str | None,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        logger.info("Loading cession file queue")
        logger.debug(
            "Cession file queue filters status=%s file_type=%s cedent_id=%s page=%s page_size=%s",
            status,
            file_type,
            cedent_id,
            page,
            page_size,
        )
        files, _ = self.repository.list_cession_files(status, file_type, cedent_id, page, page_size)
        all_files = self.repository.list_all_cession_files()
        return {
            "metrics": self._build_list_metrics(all_files),
            "items": [self._serialize_queue_item(item) for item in files],
        }

    async def upload_cession_file(
        self,
        file: UploadFile,
        background_tasks: BackgroundTasks,
        cedent_id: str | None,
        contract_id: str | None,
        file_type: str | None = None,
    ) -> dict[str, Any]:
        logger.info("Uploading cession file into claims pipeline")
        logger.debug(
            "Claims upload filename=%s provided_cedent_id=%s provided_contract_id=%s provided_file_type=%s",
            file.filename,
            cedent_id,
            contract_id,
            file_type,
        )
        if not file.filename:
            logger.error("Claims upload rejected because filename is empty")
            raise IrisAPIError(400, "Invalid file", "Uploaded file must include a filename")

        provided_contract = self.repository.get_contract(contract_id) if contract_id else None
        if contract_id and provided_contract is None:
            logger.error("Claims upload failed because contract_id=%s was not found", contract_id)
            raise IrisAPIError(404, "Invalid contract ID", "Contract not found in DB")

        provided_cedent = self.repository.get_cedent(cedent_id) if cedent_id else None
        if cedent_id and provided_cedent is None:
            logger.error("Claims upload failed because cedent_id=%s was not found", cedent_id)
            raise IrisAPIError(404, "Invalid cedent ID", "Cedent not found in DB")

        raw_bytes = await file.read()
        try:
            content = extract_tabular_upload_text(file.filename, raw_bytes)
        except ValueError as exc:
            logger.error("Claims upload rejected because the file could not be parsed filename=%s", file.filename)
            raise IrisAPIError(400, "Invalid file", str(exc)) from exc
        now = datetime.now(UTC)
        detection_seed = self._detect_file_profile(file.filename, content, provided_cedent, provided_contract, allow_ai=True)
        manual_file_type = self._normalize_file_type(file_type)
        if file_type and manual_file_type is None:
            logger.error("Claims upload rejected because file_type=%s is invalid", file_type)
            raise IrisAPIError(400, "Invalid file type", f"{file_type} is not supported")
        if manual_file_type:
            logger.info("Manual cession file type supplied during upload")
            logger.debug("Manual upload file_type=%s filename=%s", manual_file_type, file.filename)
            detection_seed["file_type"] = manual_file_type
            detection_seed["file_type_confidence"] = 1.0
            detection_seed["iris_reasoning"] = (
                f'Manual file type "{manual_file_type}" supplied; cedant and contract were derived from filename and DB context.'
            )
        effective_cedent_id = provided_contract.cedent_id if provided_contract else (cedent_id or detection_seed["cedent_id"])
        effective_contract_id = contract_id or detection_seed["contract_id"]
        record_count = self._count_records(file.filename, content) or detection_seed["record_count"]
        file_id = self.repository.get_next_cession_file_id(now.year)
        upload_audit_event = {
            "timestamp": self._to_iso(now),
            "actor": "Claims Ops",
            "type": "Human",
            "action": "File uploaded manually",
            "detail": file.filename,
        }

        cession_file = CessionFile(
            file_id=file_id,
            contract_id=effective_contract_id,
            cedent_id=effective_cedent_id,
            filename=file.filename,
            file_type=detection_seed["file_type"],
            record_count=record_count,
            received_at=now,
            received_via="Manual Upload",
            stage="uploaded",
            ai_file_type_confidence=detection_seed["file_type_confidence"],
            ai_cedent_confidence=detection_seed["cedent_confidence"],
            error_count=0,
            warning_count=0,
            critical_count=0,
            sla_deadline=now + timedelta(days=5),
            created_at=now,
            updated_at=now,
        )
        created = self.repository.create_cession_file(cession_file)
        self._store_override(
            created.file_id,
            {
                "pipeline_session_id": f"pipe-{uuid.uuid4()}",
                "active_step": "detect",
                "source_filename": file.filename,
                "source_size_bytes": len(raw_bytes),
                "source_content_text": content,
                "manual_cedent_id": cedent_id,
                "manual_contract_id": contract_id,
                "manual_file_type": manual_file_type,
                "detection_override": None,
                "contract_override": None,
                "audit_events": [upload_audit_event],
                "stage_history": [{"stage": "uploaded", "completed_at": self._to_iso(now)}],
            },
        )
        self._persist_claims_audit_event(
            module="cession",
            entity_id=created.file_id,
            entity_type="cession_file",
            event=upload_audit_event,
            contract_id=created.contract_id,
            cedent_id=created.cedent_id,
            cession_file_id=created.id,
        )
        self._append_stage_log(created.file_id, "upload", "complete", now)
        self._append_stage_log(created.file_id, "detect", "in_progress", now + timedelta(seconds=5))

        background_tasks.add_task(self._mark_uploaded_file_detecting, created.file_id)
        return {
            "file_id": created.file_id,
            "status": "uploaded",
            "pipeline_session_id": self._get_override(created.file_id).get("pipeline_session_id"),
            "next_stage": "detecting",
        }

    def get_cession_file_detail(self, file_id: str) -> dict[str, Any]:
        logger.info("Loading cession file detail")
        logger.debug("Cession file detail file_id=%s", file_id)
        cession_file = self._get_cession_file_or_error(file_id)
        return self._build_file_detail(cession_file)

    def advance_pipeline_stage(self, file_id: str, stage: str, payload: dict[str, Any]) -> dict[str, Any]:
        logger.info("Advancing cession pipeline stage")
        logger.debug("Cession pipeline stage file_id=%s stage=%s payload=%s", file_id, stage, payload)
        cession_file = self._get_cession_file_or_error(file_id)

        if stage == "detect":
            return self._handle_detect(cession_file, payload)
        if stage == "map-contract":
            return self._handle_map_contract(cession_file, payload)
        if stage == "clauses":
            return self._handle_clauses(cession_file)
        if stage == "validate":
            return self._handle_validate(cession_file)
        if stage == "process-exceptions":
            return self._handle_process_exceptions(cession_file, payload)
        if stage == "process":
            return self._handle_process(cession_file)
        if stage == "approve":
            return self._handle_approve(cession_file)

        logger.error("Unsupported cession pipeline stage requested stage=%s", stage)
        raise IrisAPIError(400, "Invalid stage", f"{stage} is not supported")

    def get_pipeline_status(self, file_id: str) -> dict[str, Any]:
        logger.info("Loading cession pipeline status")
        logger.debug("Cession pipeline status file_id=%s", file_id)
        cession_file = self._get_cession_file_or_error(file_id)
        detail = self._build_file_detail(cession_file)
        current_step = detail["current_step"]
        return {
            "file_id": cession_file.file_id,
            "current_stage": current_step.replace("-", "_"),
            "pct_complete": self._step_completion_pct(current_step, cession_file.stage),
            "stage_log": self._build_stage_log(cession_file),
        }

    def get_cession_file_summary(self, file_id: str) -> dict[str, Any]:
        logger.info("Loading cession file processing summary")
        logger.debug("Cession file summary file_id=%s", file_id)
        cession_file = self._get_cession_file_or_error(file_id)
        self._ensure_records_and_exceptions(cession_file)
        return self._build_summary_payload(cession_file)

    def list_settlements(
        self,
        status: str,
        contract_id: str | None,
        cedent_id: str | None,
        period: str | None,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        logger.info("Loading settlements worklist")
        logger.debug(
            "Settlement queue filters status=%s contract_id=%s cedent_id=%s period=%s page=%s page_size=%s",
            status,
            contract_id,
            cedent_id,
            period,
            page,
            page_size,
        )
        settlements = self._load_settlements()
        filtered = [
            item
            for item in settlements
            if self._matches_settlement_filters(item, status, contract_id, cedent_id, period)
        ]
        filtered.sort(key=lambda item: (item.get("payment_due_date") or "", item.get("settlement_id") or ""))
        filtered.sort(key=self._settlement_sort_timestamp, reverse=True)
        logger.debug(
            "Settlement queue ordered by latest update first top_settlement_id=%s",
            filtered[0]["settlement_id"] if filtered else None,
        )
        start = max(page - 1, 0) * page_size
        end = start + page_size
        return {
            "metrics": self._build_settlement_metrics(settlements),
            "items": [self._serialize_settlement_list_item(item) for item in filtered[start:end]],
        }

    def get_settlement_detail(self, settlement_id: str) -> dict[str, Any]:
        logger.info("Loading settlement detail")
        logger.debug("Settlement detail settlement_id=%s", settlement_id)
        settlement = self._get_settlement_or_error(settlement_id)
        return self._build_settlement_detail(settlement)

    def approve_settlement(self, settlement_id: str, notes: str | None) -> dict[str, Any]:
        logger.info("Approving settlement for payment")
        logger.debug("Settlement approval settlement_id=%s notes=%s", settlement_id, notes)
        settlement = self._get_settlement_or_error(settlement_id)
        if settlement["status"] == "approved":
            logger.error("Settlement approval rejected because settlement_id=%s is already approved", settlement_id)
            raise IrisAPIError(400, "Invalid settlement status", "Settlement is already approved")

        approved_at = datetime.now(UTC)
        self._store_settlement_override(
            settlement_id,
            {
                "status": "approved",
                "notes": notes,
                "approved_at": self._to_iso(approved_at),
                "dispute_reason": None,
                "last_updated": self._to_iso(approved_at),
            },
        )
        self._append_settlement_audit_event(
            settlement_id,
            {
                "actor": "Claims Ops",
                "type": "Human",
                "action": "Settlement approved",
                "detail": notes or "Approved after settlement review",
                "timestamp": self._to_iso(approved_at),
            },
        )
        return {
            "settlement_id": settlement_id,
            "status": "approved",
            "approved_at": self._to_iso(approved_at),
        }

    def dispute_settlement(self, settlement_id: str, reason: str) -> dict[str, Any]:
        logger.info("Raising settlement dispute")
        logger.debug("Settlement dispute settlement_id=%s reason=%s", settlement_id, reason)
        settlement = self._get_settlement_or_error(settlement_id)
        if settlement["status"] == "disputed":
            logger.error("Settlement dispute rejected because settlement_id=%s is already disputed", settlement_id)
            raise IrisAPIError(400, "Invalid settlement status", "Settlement is already disputed")

        disputed_at = datetime.now(UTC)
        self._store_settlement_override(
            settlement_id,
            {
                "status": "disputed",
                "dispute_reason": reason,
                "approved_at": None,
                "last_updated": self._to_iso(disputed_at),
            },
        )
        self._append_settlement_audit_event(
            settlement_id,
            {
                "actor": "Claims Ops",
                "type": "Human",
                "action": "Settlement disputed",
                "detail": reason,
                "timestamp": self._to_iso(disputed_at),
            },
        )
        self._create_settlement_worklist_item(
            settlement,
            priority="high",
            status="pending_review",
            title=f"Settlement dispute review - {settlement_id}",
            description=reason,
            breadcrumb="Settlement - Dispute Review",
        )
        return {
            "settlement_id": settlement_id,
            "status": "disputed",
            "disputed_at": self._to_iso(disputed_at),
        }

    def hold_settlement(self, settlement_id: str, reason: str | None) -> dict[str, Any]:
        logger.info("Holding settlement for manual review")
        logger.debug("Settlement hold settlement_id=%s reason=%s", settlement_id, reason)
        settlement = self._get_settlement_or_error(settlement_id)
        if settlement["status"] == "held":
            logger.error("Settlement hold rejected because settlement_id=%s is already held", settlement_id)
            raise IrisAPIError(400, "Invalid settlement status", "Settlement is already held")

        held_at = datetime.now(UTC)
        hold_reason = reason or "Held for manual reconciliation review."
        self._store_settlement_override(
            settlement_id,
            {
                "status": "held",
                "notes": hold_reason,
                "approved_at": None,
                "last_updated": self._to_iso(held_at),
            },
        )
        self._append_settlement_audit_event(
            settlement_id,
            {
                "actor": "Claims Ops",
                "type": "Human",
                "action": "Payment held",
                "detail": hold_reason,
                "timestamp": self._to_iso(held_at),
            },
        )
        self._create_settlement_worklist_item(
            settlement,
            priority="high",
            status="open",
            title=f"Settlement payment hold - {settlement_id}",
            description=hold_reason,
            breadcrumb="Settlement - Payment Held",
        )
        return {
            "settlement_id": settlement_id,
            "status": "held",
            "held_at": self._to_iso(held_at),
        }

    def upsert_mock_settlement(self, settlement_row: dict[str, Any]) -> dict[str, Any]:
        logger.info("Upserting mock settlement row from pipeline outcome")
        logger.debug("Mock settlement upsert payload=%s", settlement_row)
        settlement_id = str(settlement_row["settlement_id"])
        period_start = self._parse_iso_date(str(settlement_row.get("period_start") or "")) or date.today()
        period_end = self._parse_iso_date(str(settlement_row.get("period_end") or "")) or period_start
        existing = self.repository.get_settlement(settlement_id)
        settlement = existing or Settlement(settlement_id=settlement_id, period_start=period_start, period_end=period_end)
        settlement.contract_id = settlement_row.get("contract_id")
        settlement.cedent_id = settlement_row.get("cedent_id")
        settlement.period_start = period_start
        settlement.period_end = period_end
        settlement.period_label = settlement_row.get("period_label")
        settlement.fixed_leg_amount = settlement_row.get("fixed_leg_amount")
        settlement.floating_leg_amount = settlement_row.get("floating_leg_amount")
        settlement.net_amount = settlement_row.get("net_amount")
        settlement.currency = settlement_row.get("currency")
        settlement.direction = settlement_row.get("direction")
        settlement.payment_due_date = self._parse_iso_date(str(settlement_row.get("payment_due_date") or ""))
        settlement.status = settlement_row.get("status", "pending_approval")
        settlement.notes = settlement_row.get("source", "Pipeline-created settlement")
        settlement.updated_at = datetime.now(UTC)
        self.repository.upsert_settlement(settlement)
        store = self._read_settlement_override_store()
        created_rows = deepcopy(store.get(CREATED_SETTLEMENTS_KEY, {}))
        created_rows[settlement_id] = settlement_row
        store[CREATED_SETTLEMENTS_KEY] = created_rows
        self._write_settlement_override_store(store)
        return self._get_settlement_or_error(settlement_id)

    def list_calculation_contracts(self) -> list[dict[str, Any]]:
        logger.info("Loading calculation-engine contract options")
        contracts = self.repository.list_all_contracts()
        cedents = {item.cedent_id: item.legal_entity_name for item in self.repository.list_all_cedents()}
        return [
            {
                "contract_id": contract.contract_id,
                "contract_name": contract.contract_name,
                "contract_version": contract.contract_version,
                "cedent_id": contract.cedent_id,
                "cedent_name": cedents.get(contract.cedent_id, "Unmapped cedent"),
                "currency": contract.currency or "USD",
                "status": contract.status or "active",
                "valuation_date": self._to_date_string(contract.effective_date or contract.inception_date),
                "assumption_snapshot": self._assumption_snapshot_label(contract.currency or "USD"),
            }
            for contract in contracts
        ]

    def run_calculation(self, payload: dict[str, Any]) -> dict[str, Any]:
        logger.info("Running claims calculation engine")
        logger.debug("Claims calculation payload=%s", payload)
        contract_id = str(payload.get("contract_id") or "")
        calculation_type = str(payload.get("calculation_type") or "").lower()
        period_start = payload.get("period_start")
        period_end = payload.get("period_end")

        contract = self.repository.get_contract(contract_id)
        if contract is None:
            logger.error("Claims calculation failed because contract_id=%s was not found", contract_id)
            raise IrisAPIError(404, "Invalid contract ID", "Contract not found in DB")
        if calculation_type not in SUPPORTED_CALCULATION_TYPES:
            logger.error("Claims calculation failed because calculation_type=%s is invalid", calculation_type)
            raise IrisAPIError(400, "Invalid calculation type", f"{calculation_type} is not supported")
        if not isinstance(period_start, date) or not isinstance(period_end, date):
            logger.error("Claims calculation failed because period dates were not supplied")
            raise IrisAPIError(400, "Invalid period", "period_start and period_end are required")
        if period_end < period_start:
            logger.error("Claims calculation failed because period_end=%s is before period_start=%s", period_end, period_start)
            raise IrisAPIError(400, "Invalid period", "period_end must be on or after period_start")

        return self._build_calculation_payload(contract, calculation_type, period_start, period_end)

    def _handle_detect(self, cession_file: CessionFile, payload: dict[str, Any]) -> dict[str, Any]:
        override_file_type = payload.get("override_file_type")
        override_cedent_id = payload.get("override_cedent_id")
        if override_file_type:
            override_file_type = self._normalize_file_type(str(override_file_type))
            if override_file_type is None:
                logger.error("Detect stage failed because override_file_type=%s is invalid", payload.get("override_file_type"))
                raise IrisAPIError(400, "Invalid file type", "Unsupported cession file type")
        override_cedent = None
        if override_cedent_id:
            override_cedent = self.repository.get_cedent(override_cedent_id)
            if override_cedent is None:
                logger.error("Detect stage failed because cedent_id=%s was not found", override_cedent_id)
                raise IrisAPIError(404, "Invalid cedent ID", "Cedent not found in DB")

        detection = self._build_detection_payload(
            cession_file,
            override_file_type=override_file_type,
            override_cedent=override_cedent,
        )
        downstream_changed = (
            cession_file.file_type != detection["file_type"]
            or cession_file.cedent_id != detection["cedent_id"]
        )
        cession_file.file_type = detection["file_type"]
        cession_file.cedent_id = detection["cedent_id"]
        if downstream_changed:
            cession_file.contract_id = None
        cession_file.ai_file_type_confidence = detection["file_type_confidence"]
        cession_file.ai_cedent_confidence = detection["cedent_confidence"]
        cession_file.stage = "detected"
        cession_file.updated_at = datetime.now(UTC)
        self.repository.update_cession_file(cession_file)
        if downstream_changed:
            self._clear_file_records_and_exceptions(cession_file)

        self._store_override(
            cession_file.file_id,
            {
                "active_step": "map-contract",
                "detection_override": {
                    "file_type": override_file_type,
                    "cedent_id": override_cedent_id,
                    "completed_at": self._to_iso(datetime.now(UTC)),
                },
            },
        )
        self._append_stage_history(cession_file.file_id, "detecting")
        self._append_stage_history(cession_file.file_id, "detected")
        self._append_stage_log(cession_file.file_id, "detect", "complete")
        self._append_stage_log(cession_file.file_id, "map-contract", "in_progress")
        self._append_audit_event(
            cession_file.file_id,
            {
                "actor": "AI Classifier v3.2",
                "type": "AI Agent",
                "action": f'Classified as "{detection["file_type"]}"',
                "detail": f'confidence {int(detection["file_type_confidence"] * 100)}%',
            },
        )
        self._append_audit_event(
            cession_file.file_id,
            {
                "actor": "AI Classifier v3.2",
                "type": "AI Agent",
                "action": f'Identified cedant {detection["cedent"]}',
                "detail": f'confidence {int(detection["cedent_confidence"] * 100)}%',
            },
        )
        return {"file_id": cession_file.file_id, "stage": "detected", "result": detection}

    def _handle_map_contract(self, cession_file: CessionFile, payload: dict[str, Any]) -> dict[str, Any]:
        override_contract_id = payload.get("override_contract_id")
        mapping = self._build_contract_mapping_payload(cession_file, override_contract_id=override_contract_id)
        downstream_changed = cession_file.contract_id != mapping["contract_id"]
        cession_file.contract_id = mapping["contract_id"]
        cession_file.stage = "mapped"
        cession_file.updated_at = datetime.now(UTC)
        self.repository.update_cession_file(cession_file)
        if downstream_changed:
            self._clear_file_records_and_exceptions(cession_file)

        self._store_override(
            cession_file.file_id,
            {
                "active_step": "clauses",
                "contract_override": {
                    "contract_id": override_contract_id,
                    "completed_at": self._to_iso(datetime.now(UTC)),
                },
            },
        )
        self._append_stage_history(cession_file.file_id, "mapped")
        self._append_stage_log(cession_file.file_id, "map-contract", "complete")
        self._append_stage_log(cession_file.file_id, "clauses", "in_progress")
        self._append_audit_event(
            cession_file.file_id,
            {
                "actor": "Pipeline Orchestrator",
                "type": "System",
                "action": f'Mapped to {mapping["contract_id"]} {mapping["version"]}',
                "detail": "Auto-mapped by cedant + period",
            },
        )
        return {"file_id": cession_file.file_id, "stage": "mapped", "result": mapping}

    def _handle_clauses(self, cession_file: CessionFile) -> dict[str, Any]:
        clauses = self._build_clauses_payload(cession_file)
        cession_file.stage = "clauses"
        cession_file.updated_at = datetime.now(UTC)
        self.repository.update_cession_file(cession_file)

        self._store_override(cession_file.file_id, {"active_step": "validate"})
        self._append_stage_history(cession_file.file_id, "clauses")
        self._append_stage_log(cession_file.file_id, "clauses", "complete")
        self._append_stage_log(cession_file.file_id, "validate", "in_progress")
        self._append_audit_event(
            cession_file.file_id,
            {
                "actor": "Contract Rules Engine",
                "type": "System",
                "action": f'Checked {len(clauses["clauses_checked"])} clauses',
                "detail": f'{clauses["flagged_count"]} flagged',
            },
        )
        return {
            "file_id": cession_file.file_id,
            "stage": "clauses",
            "clauses_checked": clauses["clauses_checked"],
        }

    def _handle_validate(self, cession_file: CessionFile) -> dict[str, Any]:
        self._ensure_records_and_exceptions(cession_file, force=True)
        validation = self._build_validation_payload(cession_file)
        unresolved_critical = self._count_unresolved_by_severity(cession_file)["critical"]
        cession_file.stage = "exceptions" if unresolved_critical else "validated"
        cession_file.updated_at = datetime.now(UTC)
        self._apply_exception_counts_to_file(cession_file)
        self.repository.update_cession_file(cession_file)

        self._store_override(
            cession_file.file_id,
            {"active_step": "exceptions" if validation["issues"] else "process"},
        )
        self._append_stage_history(cession_file.file_id, "validated")
        self._append_stage_log(cession_file.file_id, "validate", "complete")
        self._append_stage_log(
            cession_file.file_id,
            "exceptions" if validation["issues"] else "process",
            "in_progress",
        )
        self._append_audit_event(
            cession_file.file_id,
            {
                "actor": "Validation Engine",
                "type": "System",
                "action": "Validation complete",
                "detail": f'{validation["critical_errors"]} critical, {validation["warnings"]} warnings',
            },
        )
        return {"file_id": cession_file.file_id, "stage": cession_file.stage, "result": validation}

    def _handle_process_exceptions(self, cession_file: CessionFile, payload: dict[str, Any]) -> dict[str, Any]:
        self._ensure_records_and_exceptions(cession_file)
        detected_file_type = self._build_detection_payload(cession_file)["file_type"]
        resolutions = payload.get("exception_resolutions", [])
        exceptions_by_id = {
            exception.id: exception for exception in self.repository.list_file_exceptions(cession_file.id)
        }
        if not resolutions:
            logger.error("Process exceptions stage rejected because no exception_resolutions were supplied")
            raise IrisAPIError(400, "Invalid request", "exception_resolutions must contain at least one item")

        now = datetime.now(UTC)
        updated_exceptions: list[CessionFileException] = []
        for item in resolutions:
            exception_id = item.get("exception_id")
            resolution = item.get("resolution")
            override_value = item.get("override_value")
            exception = exceptions_by_id.get(exception_id)
            if exception is None:
                logger.error("Exception resolution failed because exception_id=%s was not found", exception_id)
                raise IrisAPIError(404, "Invalid exception ID", "Exception not found for this file")
            if resolution not in {"accepted", "overridden", "rejected"}:
                logger.error("Exception resolution failed because resolution=%s is invalid", resolution)
                raise IrisAPIError(400, "Invalid resolution", f"{resolution} is not supported")
            if exception.issue_type == "missing_active_member" and resolution in {"accepted", "overridden"}:
                logger.error("Coverage exception cannot be accepted without a replacement upload exception_id=%s", exception_id)
                raise IrisAPIError(
                    400,
                    "Active member missing",
                    "Upload a corrected Pension Status file that includes every current active member before processing",
                )

            exception.resolution = resolution
            exception.resolved_at = now
            if resolution == "accepted" and exception.ai_suggestion:
                exception.current_value = exception.ai_suggestion
            if resolution == "overridden":
                if not override_value:
                    logger.error("Exception override failed because override_value was missing for exception_id=%s", exception_id)
                    raise IrisAPIError(400, "Invalid resolution", "override_value is required for overridden exceptions")
                exception.current_value = str(override_value)
            updated_exceptions.append(exception)

        self.repository.update_file_exceptions(updated_exceptions)
        self._apply_filetype_exception_resolutions(cession_file, detected_file_type, updated_exceptions)
        self._apply_exception_counts_to_file(cession_file)
        pending = self._count_unresolved_by_severity(cession_file)
        cession_file.stage = "validated" if sum(pending.values()) == 0 else "exceptions"
        cession_file.updated_at = now
        self.repository.update_cession_file(cession_file)

        self._store_override(
            cession_file.file_id,
            {"active_step": "process" if sum(pending.values()) == 0 else "exceptions"},
        )
        self._append_stage_log(cession_file.file_id, "exceptions", "complete" if sum(pending.values()) == 0 else "in_progress")
        if sum(pending.values()) == 0:
            self._append_stage_history(cession_file.file_id, "exceptions")
            self._append_stage_log(cession_file.file_id, "process", "in_progress")
        self._append_audit_event(
            cession_file.file_id,
            {
                "actor": "Claims Ops",
                "type": "Human",
                "action": "Resolution handling updated",
                "detail": f'{len(updated_exceptions)} resolutions saved',
            },
        )
        return {
            "file_id": cession_file.file_id,
            "stage": cession_file.stage,
            "result": {
                "resolved_count": sum(1 for item in updated_exceptions if item.resolution in {"accepted", "overridden"}),
                "rejected_count": sum(1 for item in updated_exceptions if item.resolution == "rejected"),
                "pending_count": sum(pending.values()),
            },
        }

    def _handle_process(self, cession_file: CessionFile) -> dict[str, Any]:
        self._ensure_records_and_exceptions(cession_file)
        pending = self._count_unresolved_by_severity(cession_file)
        if sum(pending.values()) > 0:
            logger.error("Process stage rejected because unresolved exceptions remain file_id=%s", cession_file.file_id)
            raise IrisAPIError(
                409,
                "Exceptions unresolved",
                "Resolve all exceptions before processing the file",
            )

        detected_file_type = self._build_detection_payload(cession_file)["file_type"]
        if detected_file_type == "Pension Status":
            self._apply_pension_status_population_changes(cession_file)
            settlement = self._create_or_update_settlement_from_contract(cession_file)
            self._store_override(cession_file.file_id, {"settlement_processing_summary": settlement})
        elif detected_file_type == "Settlement":
            settlement = self._create_or_update_settlement_from_file(cession_file)
            self._store_override(cession_file.file_id, {"settlement_processing_summary": settlement})

        cession_file.stage = "processed"
        cession_file.updated_at = datetime.now(UTC)
        self.repository.update_cession_file(cession_file)
        worklist_items = self._ensure_processing_worklist_items(cession_file)
        summary = self._build_summary_payload(cession_file)

        self._store_override(cession_file.file_id, {"active_step": "summary"})
        self._append_stage_history(cession_file.file_id, "processing")
        self._append_stage_history(cession_file.file_id, "processed")
        self._append_stage_log(cession_file.file_id, "process", "complete")
        self._append_stage_log(cession_file.file_id, "summary", "in_progress")
        self._append_audit_event(
            cession_file.file_id,
            {
                "actor": "Claims Engine",
                "type": "System",
                "action": "Processing complete",
                "detail": f'{summary["records_processed"]} records applied',
            },
        )
        if worklist_items:
            self._append_audit_event(
                cession_file.file_id,
                {
                    "actor": "Workflow Router",
                    "type": "System",
                    "action": f'Created {len(worklist_items)} worklist item(s)',
                    "detail": ", ".join(item.wl_id for item in worklist_items),
                },
            )
        return {"file_id": cession_file.file_id, "stage": "processed", "result": summary}

    def _handle_approve(self, cession_file: CessionFile) -> dict[str, Any]:
        cession_file.stage = "approved"
        cession_file.updated_at = datetime.now(UTC)
        self.repository.update_cession_file(cession_file)

        self._store_override(cession_file.file_id, {"active_step": "audit"})
        self._append_stage_history(cession_file.file_id, "approved")
        self._append_stage_log(cession_file.file_id, "summary", "complete")
        self._append_stage_log(cession_file.file_id, "worklist", "complete")
        self._append_stage_log(cession_file.file_id, "audit", "complete")
        self._append_audit_event(
            cession_file.file_id,
            {
                "actor": "Claims Ops",
                "type": "Human",
                "action": "Approved processing outcome",
                "detail": cession_file.file_id,
            },
        )
        return {
            "file_id": cession_file.file_id,
            "stage": "approved",
            "result": {"approved": True},
        }

    def _apply_pension_status_population_changes(self, cession_file: CessionFile) -> dict[str, Any]:
        if not cession_file.contract_id:
            logger.error("Pension Status processing failed because contract mapping is missing file_id=%s", cession_file.file_id)
            raise IrisAPIError(400, "Contract mapping required", "Map the cession file to a contract before processing")

        received_date = (
            cession_file.received_at.astimezone(UTC).date()
            if cession_file.received_at and cession_file.received_at.tzinfo
            else (cession_file.received_at.date() if cession_file.received_at else date.today())
        )
        overrides_by_row = self._resolved_population_overrides(cession_file)
        parsed_rows: list[PopulationCsvNormalizedRow] = []

        for record in self.repository.list_file_records(cession_file.id):
            mapped_data = json.loads(record.mapped_data or "{}")
            mapped_data.update(overrides_by_row.get(record.row_number, {}))
            normalized = self._population_row_from_pipeline(mapped_data, received_date)
            if normalized is not None:
                parsed_rows.append(normalized)

        current_rows = {
            row.member_id: row
            for row in self.repository.list_current_population_for_members(
                cession_file.contract_id,
                [row.member_id for row in parsed_rows],
            )
        }
        rows_to_save: list[PolicyRegister] = []
        summary = {
            "new_active": 0,
            "new_deferred": 0,
            "new_deceased": 0,
            "created": 0,
            "updated": 0,
            "unchanged": 0,
            "skipped": 0,
            "records_processed": len(parsed_rows),
            "liability_impact": 0,
            "insight": "No policy-register changes were required for this pension status file.",
        }

        for row in parsed_rows:
            current = current_rows.get(row.member_id)
            effective_from = row.effective_from or received_date

            if current is None:
                logger.error(
                    "Pension Status processing skipped row because member_id=%s is not current in contract_id=%s",
                    row.member_id,
                    cession_file.contract_id,
                )
                summary["skipped"] += 1
                continue

            if current and self._population_rows_match(current, row) and current.source_cession_file_id == cession_file.id:
                summary["unchanged"] += 1
                continue

            if current and self._population_rows_match(current, row):
                summary["unchanged"] += 1
                continue

            if effective_from <= current.effective_from:
                effective_from = current.effective_from + timedelta(days=1)
            current.is_current = False
            current.effective_to = effective_from - timedelta(days=1)
            rows_to_save.append(current)
            summary["updated"] += 1

            rows_to_save.append(self._build_population_record(cession_file.contract_id, row, effective_from, cession_file.id))
            self._increment_population_change_counter(summary, row.status)

        if rows_to_save:
            self.repository.save_population_records(rows_to_save)
        summary["liability_impact"] = self._estimate_pension_status_liability_impact(parsed_rows, current_rows)

        if summary["created"] or summary["updated"]:
            summary["insight"] = (
                f"Applied {summary['created'] + summary['updated']} pension status movement(s) "
                f"into the policy register for {cession_file.contract_id}."
            )

        logger.info("Applied Pension Status movements to policy register")
        logger.debug(
            "Pension Status processing file_id=%s contract_id=%s created=%s updated=%s unchanged=%s",
            cession_file.file_id,
            cession_file.contract_id,
            summary["created"],
            summary["updated"],
            summary["unchanged"],
        )
        self._store_override(cession_file.file_id, {"population_processing_summary": summary})
        return summary

    def _create_or_update_settlement_from_contract(self, cession_file: CessionFile) -> dict[str, Any]:
        contract = self.repository.get_contract(cession_file.contract_id)
        if contract is None:
            logger.error("Settlement creation failed because contract is missing file_id=%s", cession_file.file_id)
            raise IrisAPIError(400, "Contract mapping required", "Map the cession file to a valid contract before settlement creation")

        period_label = self._build_contract_mapping_payload(cession_file)["period"]
        period_start, period_end = self._period_bounds(period_label)
        fixed_leg = self._fixed_leg_from_contract(contract, period_start, period_end)
        floating_leg = self._floating_leg_from_population(contract.contract_id)
        net_amount = round(floating_leg - fixed_leg, 2)
        settlement_id = self._settlement_id_for(contract.contract_id, period_label)
        direction = "reinsurer_to_cedant" if net_amount > 0 else "cedant_to_reinsurer"
        now = datetime.now(UTC)

        existing = self.repository.get_settlement(settlement_id)
        settlement = existing or Settlement(
            settlement_id=settlement_id,
            period_start=period_start,
            period_end=period_end,
            created_at=now,
        )
        settlement.contract_id = contract.contract_id
        settlement.cedent_id = contract.cedent_id
        settlement.cession_file_id = cession_file.id
        settlement.period_start = period_start
        settlement.period_end = period_end
        settlement.period_label = period_label
        settlement.fixed_leg_amount = fixed_leg
        settlement.floating_leg_amount = floating_leg
        settlement.net_amount = net_amount
        settlement.currency = contract.currency or "USD"
        settlement.direction = direction
        settlement.payment_due_date = period_end + timedelta(days=30)
        settlement.status = "pending_approval"
        settlement.notes = f"Created from cession file {cession_file.file_id}"
        settlement.updated_at = now
        created = self.repository.upsert_settlement(settlement)

        settlement_row = self._serialize_settlement_model(created)
        self._store_settlement_override(
            settlement_id,
            {
                "source": f"{cession_file.file_id} ({cession_file.filename})",
                "iris_recommendation": "accept" if abs(net_amount) < max(fixed_leg * 0.01, 50000) else "review",
                "last_updated": self._to_iso(now),
            },
        )
        self._append_settlement_audit_event(
            settlement_id,
            {
                "actor": "Settlement Engine",
                "type": "System",
                "action": "Settlement created from Pension Status processing",
                "detail": f"fixed={fixed_leg:.2f}; floating={floating_leg:.2f}; net={net_amount:.2f}",
                "timestamp": self._to_iso(now),
            },
        )
        logger.info("Created settlement from cession processing")
        logger.debug("Settlement created file_id=%s settlement=%s", cession_file.file_id, settlement_row)
        return settlement_row

    def _create_or_update_settlement_from_file(self, cession_file: CessionFile) -> dict[str, Any]:
        logger.info("Reconciling uploaded Settlement file against IRiS expected values")
        logger.debug("Settlement reconciliation processing file_id=%s contract_id=%s", cession_file.file_id, cession_file.contract_id)
        reconciliation = self._build_settlement_reconciliation_payload(cession_file)
        if not reconciliation:
            logger.error("Settlement processing failed because no reconciliation payload exists file_id=%s", cession_file.file_id)
            raise IrisAPIError(400, "Settlement reconciliation missing", "Validate the Settlement file before processing")

        contract = self.repository.get_contract(cession_file.contract_id)
        if contract is None:
            logger.error("Settlement processing failed because contract mapping is missing file_id=%s", cession_file.file_id)
            raise IrisAPIError(400, "Contract mapping required", "Map the cession file to a valid contract before settlement processing")

        decision = reconciliation["decision"]
        if decision != "accept":
            logger.info(
                "Settlement reconciliation requires Claims Ops review file_id=%s settlement_id=%s mismatches=%s",
                cession_file.file_id,
                reconciliation["settlement_id"],
                reconciliation["mismatches"],
            )
        else:
            logger.info("Settlement reconciliation matched expected values")
            logger.debug("Settlement exact-match payload=%s", reconciliation)

        period_start = self._parse_iso_date(reconciliation["period_start"])
        period_end = self._parse_iso_date(reconciliation["period_end"])
        payment_date = self._parse_iso_date(str(reconciliation.get("payment_date") or ""))
        if period_start is None or period_end is None:
            logger.error("Settlement processing failed because period bounds are invalid payload=%s", reconciliation)
            raise IrisAPIError(400, "Invalid calculation period", "Settlement calculation period could not be parsed")

        now = datetime.now(UTC)
        settlement = self.repository.get_settlement(reconciliation["settlement_id"]) or Settlement(
            settlement_id=reconciliation["settlement_id"],
            period_start=period_start,
            period_end=period_end,
            created_at=now,
        )
        settlement.contract_id = contract.contract_id
        settlement.cedent_id = contract.cedent_id
        settlement.cession_file_id = cession_file.id
        settlement.period_start = period_start
        settlement.period_end = period_end
        settlement.period_label = reconciliation["calculation_period"]
        settlement.fixed_leg_amount = reconciliation["uploaded"]["fixed_leg"]
        settlement.floating_leg_amount = reconciliation["uploaded"]["floating_leg"]
        settlement.net_amount = reconciliation["uploaded"]["net_settlement_amount"]
        settlement.currency = reconciliation["currency"]
        settlement.direction = "reinsurer_to_cedant" if self._to_float(settlement.net_amount) > 0 else "cedant_to_reinsurer"
        settlement.payment_due_date = payment_date or period_end + timedelta(days=30)
        settlement.payment_date = payment_date
        settlement_status = "pending_approval" if decision == "accept" else "pending_reconciliation"
        settlement.status = settlement_status
        settlement.notes = f"Created from Settlement file {cession_file.file_id}; reconciliation decision={decision}"
        settlement.updated_at = now
        created = self.repository.upsert_settlement(settlement)
        settlement_row = self._serialize_settlement_model(created)

        self._store_settlement_override(
            reconciliation["settlement_id"],
            {
                "source": f"{cession_file.file_id} ({cession_file.filename})",
                "iris_recommendation": decision,
                "status": settlement_status,
                "last_updated": self._to_iso(now),
                "settlement_reconciliation": reconciliation,
            },
        )
        self._append_settlement_audit_event(
            reconciliation["settlement_id"],
            {
                "actor": "Settlement Reconciliation Engine",
                "type": "System",
                "action": "Settlement file reconciled",
                "detail": f"decision={decision}; mismatches={len(reconciliation['mismatches'])}",
                "timestamp": self._to_iso(now),
            },
        )
        logger.info("Created or updated settlement from Settlement file")
        logger.debug("Settlement file upsert file_id=%s settlement=%s", cession_file.file_id, settlement_row)
        settlement_row["iris_recommendation"] = decision
        settlement_row["settlement_reconciliation"] = reconciliation
        cedent = self.repository.get_cedent(contract.cedent_id)
        report_artifacts = generate_settlement_report_files(
            cession_file=cession_file,
            contract=contract,
            cedent_name=cedent.legal_entity_name if cedent else "Unmapped cedent",
            settlement_row=settlement_row,
            reconciliation=reconciliation,
            generated_at=now,
        )
        settlement_row["settlement_report_artifacts"] = report_artifacts
        return settlement_row

    def _resolved_population_overrides(self, cession_file: CessionFile) -> dict[int, dict[str, Any]]:
        overrides: dict[int, dict[str, Any]] = {}
        for exception in self.repository.list_file_exceptions(cession_file.id):
            if exception.resolution not in {"accepted", "overridden"}:
                continue
            if exception.current_value is None:
                continue
            overrides.setdefault(exception.row_number, {})[exception.field_name] = exception.current_value
        return overrides

    def _population_row_from_pipeline(
        self,
        mapped_data: dict[str, Any],
        received_date: date,
    ) -> PopulationCsvNormalizedRow | None:
        member_id = str(mapped_data.get("member_id") or "").strip()
        date_of_birth = self._parse_iso_date(str(mapped_data.get("date_of_birth") or ""))
        gender = str(mapped_data.get("gender") or "").strip().upper()
        annual_pension_value = mapped_data.get("annual_pension")
        status = str(mapped_data.get("status") or "active").strip().lower()
        if not member_id or date_of_birth is None or gender not in {"M", "F"} or annual_pension_value in {None, ""}:
            return None

        try:
            annual_pension = Decimal(str(annual_pension_value))
        except Exception:
            return None

        escalation_rate_value = mapped_data.get("escalation_rate")
        try:
            escalation_rate = Decimal(str(escalation_rate_value)) if escalation_rate_value not in {None, ""} else None
        except Exception:
            escalation_rate = None

        return PopulationCsvNormalizedRow(
            member_id=member_id,
            policy_id=str(mapped_data.get("policy_id") or "").strip() or None,
            date_of_birth=date_of_birth,
            gender=gender,
            smoker_status=str(mapped_data.get("smoker_status") or "").strip() or None,
            postcode=str(mapped_data.get("postcode") or "").strip() or None,
            annual_pension=annual_pension,
            pension_currency=str(mapped_data.get("pension_currency") or "GBP").strip().upper() or "GBP",
            escalation_type=str(mapped_data.get("escalation_type") or "").strip() or None,
            escalation_rate=escalation_rate,
            status=status,
            date_of_death=self._parse_iso_date(str(mapped_data.get("date_of_death") or "")),
            commencement_date=self._parse_iso_date(str(mapped_data.get("commencement_date") or "")),
            effective_from=self._parse_iso_date(str(mapped_data.get("effective_from") or "")) or received_date,
            verification_reference=str(mapped_data.get("verification_reference") or "").strip() or None,
        )

    def _increment_population_change_counter(self, summary: dict[str, Any], status: str) -> None:
        counter_key = {
            "active": "new_active",
            "deferred": "new_deferred",
            "deceased": "new_deceased",
        }.get(status)
        if counter_key:
            summary[counter_key] += 1

    def _estimate_pension_status_liability_impact(
        self,
        parsed_rows: list[PopulationCsvNormalizedRow],
        current_rows: dict[str, PolicyRegister],
    ) -> float:
        if not parsed_rows:
            return 0.0
        incoming_frame = pd.DataFrame(
            [
                {
                    "member_id": row.member_id,
                    "incoming_status": row.status,
                    "incoming_annual_pension": float(row.annual_pension),
                }
                for row in parsed_rows
            ]
        )
        current_frame = pd.DataFrame(
            [
                {
                    "member_id": member_id,
                    "current_status": row.status,
                    "current_annual_pension": float(row.annual_pension or 0),
                }
                for member_id, row in current_rows.items()
            ]
        )
        if incoming_frame.empty or current_frame.empty:
            return 0.0
        movement_frame = incoming_frame.merge(current_frame, how="inner", on="member_id")
        changed = movement_frame[movement_frame["incoming_status"] != movement_frame["current_status"]].copy()
        if changed.empty:
            return 0.0
        changed["directional_factor"] = 0.0
        changed.loc[
            changed["current_status"].eq("active") & changed["incoming_status"].ne("active"),
            "directional_factor",
        ] = -1.0
        changed.loc[
            changed["current_status"].ne("active") & changed["incoming_status"].eq("active"),
            "directional_factor",
        ] = 1.0
        changed["impact"] = changed["current_annual_pension"] * changed["directional_factor"]
        return round(float(changed["impact"].sum()), 2)

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

    def _build_file_detail(self, cession_file: CessionFile) -> dict[str, Any]:
        detection = self._build_detection_payload(cession_file)
        mapping = self._build_contract_mapping_payload(cession_file)
        clauses = self._build_clauses_payload(cession_file)
        validation = self._build_validation_payload(cession_file)
        exceptions = self._build_exceptions_payload(cession_file)
        summary = self._build_summary_payload(cession_file)
        worklist = self._build_worklist_payload(cession_file)
        audit = self._build_audit_payload(cession_file)
        active_step = self._resolve_active_step(cession_file)

        return {
            "file_id": cession_file.file_id,
            "filename": cession_file.filename,
            "cedent": detection["cedent"],
            "cedent_id": detection["cedent_id"],
            "contract_id": mapping["contract_id"],
            "file_type": detection["file_type"],
            "records": cession_file.record_count or 0,
            "stage": cession_file.stage,
            "current_step": active_step,
            "stage_history": self._build_stage_history(cession_file),
            "detection": detection,
            "contract_mapping": mapping,
            "clauses": clauses,
            "validation": validation,
            "exceptions": exceptions,
            "process": self._build_process_payload(cession_file),
            "summary": summary,
            "worklist": worklist,
            "audit": audit,
        }

    def _serialize_queue_item(self, cession_file: CessionFile) -> dict[str, Any]:
        cedent = self.repository.get_cedent(cession_file.cedent_id)
        return {
            "file_id": cession_file.file_id,
            "filename": cession_file.filename,
            "cedent": cedent.legal_entity_name if cedent else "Unmapped cedent",
            "cedent_id": cession_file.cedent_id,
            "file_type": cession_file.file_type or "Unclassified",
            "contract_id": cession_file.contract_id,
            "records": cession_file.record_count or 0,
            "stage": cession_file.stage,
            "critical_count": cession_file.critical_count or 0,
            "received_at": self._to_iso(cession_file.received_at),
            "sla_deadline": self._to_iso(cession_file.sla_deadline),
        }

    def _build_list_metrics(self, all_files: list[CessionFile]) -> dict[str, Any]:
        metrics = deepcopy(LIST_METRICS_BASELINE)
        seeded_ids = {record["file_id"] for record in load_mock_data("cession_files_seed.json")}
        extra_files = [item for item in all_files if item.file_id not in seeded_ids]
        if extra_files:
            metrics["in_pipeline"] += sum(1 for item in extra_files if item.stage not in {"approved", "rejected"})
            metrics["exceptions"] += sum(
                1 for item in extra_files if item.stage == "exceptions" or (item.critical_count or 0) > 0
            )
            metrics["processed"] += sum(1 for item in extra_files if item.stage in {"processed", "approved"})
            metrics["pipeline_throughput"]["records_ingested"] += sum(item.record_count or 0 for item in extra_files)
            metrics["pipeline_throughput"]["files"] += len(extra_files)
            metrics["pipeline_throughput"]["in_exception"] += sum(
                1 for item in extra_files if item.stage == "exceptions" or (item.critical_count or 0) > 0
            )
        return metrics

    def _build_detection_payload(
        self,
        cession_file: CessionFile,
        override_file_type: str | None = None,
        override_cedent: Any | None = None,
    ) -> dict[str, Any]:
        override_store = self._get_override(cession_file.file_id)
        detection_seed = self._detect_file_profile(
            cession_file.filename,
            override_store.get("source_content_text", ""),
            allow_ai=False,
        )
        stored_override = override_store.get("detection_override") or {}

        file_type = override_file_type or stored_override.get("file_type") or cession_file.file_type or detection_seed["file_type"]
        cedent_id = (
            override_cedent.cedent_id
            if override_cedent
            else stored_override.get("cedent_id")
            or cession_file.cedent_id
            or detection_seed["cedent_id"]
        )
        cedent = self.repository.get_cedent(cedent_id)

        if override_file_type or override_cedent:
            file_type_confidence = 1.0 if override_file_type else detection_seed["file_type_confidence"]
            cedent_confidence = 1.0 if override_cedent else detection_seed["cedent_confidence"]
            reasoning = "Manual override applied by claims operator."
        else:
            file_type_confidence = self._to_float(cession_file.ai_file_type_confidence) or detection_seed["file_type_confidence"]
            cedent_confidence = self._to_float(cession_file.ai_cedent_confidence) or detection_seed["cedent_confidence"]
            reasoning = detection_seed["iris_reasoning"]

        return {
            "file_type": file_type,
            "file_type_confidence": round(file_type_confidence, 2),
            "cedent": cedent.legal_entity_name if cedent else detection_seed["cedent_name"],
            "cedent_id": cedent_id,
            "cedent_confidence": round(cedent_confidence, 2),
            "iris_reasoning": reasoning,
        }

    def _build_contract_mapping_payload(
        self,
        cession_file: CessionFile,
        override_contract_id: str | None = None,
    ) -> dict[str, Any]:
        detection = self._build_detection_payload(cession_file)
        override_store = self._get_override(cession_file.file_id)
        contract_override = (override_store.get("contract_override") or {}).get("contract_id")
        selected_contract_id = override_contract_id or contract_override or cession_file.contract_id
        contract = self.repository.get_contract(selected_contract_id)
        if override_contract_id and contract is None:
            logger.error("Contract mapping override failed because contract_id=%s was not found", override_contract_id)
            raise IrisAPIError(404, "Invalid contract ID", "Contract not found in DB")

        if contract is not None and not override_contract_id and detection["cedent_id"] and contract.cedent_id != detection["cedent_id"]:
            logger.info("Discarding stale contract mapping because cedent changed")
            logger.debug(
                "Stale mapping file_id=%s contract_id=%s contract_cedent=%s detected_cedent=%s",
                cession_file.file_id,
                contract.contract_id,
                contract.cedent_id,
                detection["cedent_id"],
            )
            contract = None

        if contract is None:
            if detection["cedent_id"]:
                contract = next(
                    (
                        item
                        for item in self.repository.list_all_contracts()
                        if item.cedent_id == detection["cedent_id"]
                    ),
                    None,
                )
            if contract is None:
                logger.error("Unable to map cession file file_id=%s to a contract", cession_file.file_id)
                raise IrisAPIError(404, "Invalid contract ID", "Contract not found in DB")

        profile = self._detect_file_profile(cession_file.filename, override_store.get("source_content_text", ""), allow_ai=False)
        is_manual_override = bool(override_contract_id)
        return {
            "contract_id": contract.contract_id,
            "contract_name": contract.contract_name,
            "version": contract.contract_version or "v1.0",
            "period": profile["period"],
            "confidence": 1.0 if is_manual_override else profile["contract_confidence"],
            "matching_basis": (
                "Manual override selected by claims operator."
                if is_manual_override
                else f'Cedant {contract.cedent_id} + File Type "{detection["file_type"]}" + Period {profile["period"]}'
            ),
            "notional": round(float(contract.notional_amount or 0), 2),
            "currency": contract.currency or "USD",
            "lives_covered": contract.lives_count or 0,
            "inception_date": contract.inception_date.isoformat() if contract.inception_date else "",
            "maturity_date": contract.maturity_date.isoformat() if contract.maturity_date else "",
            "status": contract.status or "active",
            "fixed_leg_rate_pct": round(float(contract.fixed_leg_rate or 0) * 100, 2),
            "floating_leg": contract.floating_leg_definition or "Realized mortality",
            "expected_fixed_leg": self._expected_fixed_leg_amount(contract),
        }

    def _build_clauses_payload(self, cession_file: CessionFile) -> dict[str, Any]:
        detection = self._build_detection_payload(cession_file)
        file_type = detection["file_type"]
        mapping = self._build_contract_mapping_payload(cession_file)
        contract_context = self.repository.get_contract_clause_context(mapping["contract_id"])
        if contract_context is None:
            logger.error("Clause extraction failed because contract_id=%s was not found by SQL", mapping["contract_id"])
            raise IrisAPIError(404, "Invalid contract ID", "Contract not found in DB")

        if file_type == "Pension Status":
            current_count = self.repository.get_current_population_count(mapping["contract_id"])
            return {
                "title": "Applicable Contract Clauses",
                "subtitle": f'4 DB-derived processing rules identified for Pension Status on {mapping["contract_id"]}.',
                "flagged_count": 1,
                "clauses_checked": [
                    {
                        "clause_id": "SQL-POLICY-REGISTER-SCOPE",
                        "clause_title": "Reference Population Scope",
                        "category": "Population",
                        "status": "matched",
                        "description": (
                            f"Pension-status member IDs must exist in current policy_register rows for {mapping['contract_id']} "
                            f"before movement processing. Current SQL population count: {current_count}."
                        ),
                        "fields_affected": ["member_id", "contract_id"],
                        "active": True,
                    },
                    {
                        "clause_id": "SQL-POLICY-REGISTER-SCD2",
                        "clause_title": "SCD2 Movement Processing",
                        "category": "Data",
                        "status": "matched",
                        "description": "Status movements update policy_register by expiring the current row and inserting a new current row.",
                        "fields_affected": ["status", "effective_from", "effective_to", "is_current"],
                        "active": True,
                    },
                    {
                        "clause_id": "SQL-POLICY-DEATH-DATE",
                        "clause_title": "Death Movement Evidence",
                        "category": "Data",
                        "status": "check_required",
                        "description": "Rows moving to deceased require date_of_death before the SQL population update can be applied.",
                        "fields_affected": ["status", "date_of_death"],
                        "active": True,
                    },
                    {
                        "clause_id": "SQL-CONTRACT-SETTLEMENT",
                        "clause_title": "Settlement Recalculation",
                        "category": "Settlement",
                        "status": "matched",
                        "description": (
                            f"Fixed leg and floating leg are recalculated from contract {mapping['contract_id']} "
                            f"and current policy_register rows after successful processing."
                        ),
                        "fields_affected": ["fixed_leg_amount", "floating_leg_amount", "net_amount"],
                        "active": True,
                    },
                ],
            }

        if file_type == "Fixed Leg":
            frequency = contract_context.get("fixed_leg_frequency") or "contract frequency"
            currency = contract_context.get("currency") or mapping["currency"]
            fixed_leg_rate = float(contract_context.get("fixed_leg_rate") or 0) * 100
            return {
                "title": "Applicable Contract Clauses",
                "subtitle": f'2 SQL-derived clauses identified for {mapping["contract_id"]}.',
                "flagged_count": 0,
                "clauses_checked": [
                    {
                        "clause_id": "SQL-CONTRACT-FIXED-LEG",
                        "clause_title": "Fixed Leg Calculation",
                        "category": "Calculation",
                        "status": "matched",
                        "description": (
                            f"{frequency} fixed leg uses notional {currency} {contract_context.get('notional_amount')} "
                            f"and fixed rate {fixed_leg_rate:.2f}% from contracts."
                        ),
                        "fields_affected": ["fixed_leg_amount"],
                        "active": True,
                    },
                    {
                        "clause_id": "SQL-CONTRACT-CURRENCY",
                        "clause_title": "Settlement Currency",
                        "category": "Calculation",
                        "status": "matched",
                        "description": f"Uploaded fixed-leg amounts must reconcile to the mapped contract currency {currency}.",
                        "fields_affected": ["currency"],
                        "active": True,
                    },
                ],
            }

        if file_type == "Settlement":
            currency = contract_context.get("currency") or mapping["currency"]
            return {
                "title": "Applicable Contract Clauses",
                "subtitle": f'3 SQL-derived settlement reconciliation controls identified for {mapping["contract_id"]}.',
                "flagged_count": 0,
                "clauses_checked": [
                    {
                        "clause_id": "SQL-SETTLEMENT-FIXED-FLOATING",
                        "clause_title": "Fixed and Floating Leg Reconciliation",
                        "category": "Settlement",
                        "status": "matched",
                        "description": "Uploaded fixed and floating legs must exactly match IRiS expected values for the mapped contract-period.",
                        "fields_affected": ["fixed_leg", "floating_leg"],
                        "active": True,
                    },
                    {
                        "clause_id": "SQL-SETTLEMENT-NET",
                        "clause_title": "Net Settlement Formula",
                        "category": "Settlement",
                        "status": "matched",
                        "description": "Net settlement is reconciled as floating leg minus fixed leg plus signed fee and prior-period interest.",
                        "fields_affected": ["net_settlement_amount", "fee", "interest_prior_period"],
                        "active": True,
                    },
                    {
                        "clause_id": "SQL-CONTRACT-CURRENCY",
                        "clause_title": "Settlement Currency",
                        "category": "Calculation",
                        "status": "matched",
                        "description": f"Settlement amounts reconcile in mapped contract currency {currency}.",
                        "fields_affected": ["fixed_leg", "floating_leg", "net_settlement_amount"],
                        "active": True,
                    },
                ],
            }


        clauses_checked = [
            {
                "clause_id": "Â§4.1",
                "clause_title": "Schema Compliance",
                "category": "Operational",
                "status": "matched",
                "description": "Uploaded file must follow the agreed submission schema and required headers.",
                "fields_affected": ["member_id", "status"],
                "active": True,
            },
            {
                "clause_id": "Â§7.3",
                "clause_title": "Material Change Reporting",
                "category": "Data",
                "status": "check_required",
                "description": "Status, mortality, or activity changes must be reported within the agreed tolerance window.",
                "fields_affected": ["status", "date_of_death", "activity_code"],
                "active": True,
            },
        ]
        return {
            "title": "Applicable Contract Clauses",
            "subtitle": f'2 clauses identified for {file_type}.',
            "flagged_count": 1,
            "clauses_checked": clauses_checked,
        }

    def _build_validation_payload(self, cession_file: CessionFile) -> dict[str, Any]:
        records = self.repository.list_file_records(cession_file.id)
        exceptions = self.repository.list_file_exceptions(cession_file.id)
        if not records and cession_file.stage not in {"validated", "exceptions", "processing", "processed", "approved"}:
            return {
                "records": cession_file.record_count or 0,
                "columns_mapped": self._columns_mapped_for_type(cession_file.file_type),
                "critical_errors": 0,
                "warnings": 0,
                "informational": 0,
                "issues": [],
            }
        issues = [self._serialize_issue(item) for item in exceptions]
        return {
            "records": cession_file.record_count or len(records),
            "columns_mapped": self._columns_mapped_for_type(cession_file.file_type),
            "critical_errors": sum(1 for item in exceptions if item.severity == "critical"),
            "warnings": sum(1 for item in exceptions if item.severity == "warning"),
            "informational": sum(1 for item in exceptions if item.severity == "info"),
            "issues": issues,
        }

    def _build_exceptions_payload(self, cession_file: CessionFile) -> dict[str, Any]:
        exceptions = self.repository.list_file_exceptions(cession_file.id)
        unresolved_counts = self._count_unresolved_by_severity(cession_file)
        return {
            "title": "Resolution Handling",
            "subtitle": f'{sum(unresolved_counts.values())} unresolved · actions required · every action audited',
            "critical": sum(1 for item in exceptions if item.severity == "critical"),
            "warnings": sum(1 for item in exceptions if item.severity == "warning"),
            "informational": sum(1 for item in exceptions if item.severity == "info"),
            "unresolved": sum(unresolved_counts.values()),
            "items": [
                {
                    **self._serialize_issue(item),
                    "exception_id": item.id,
                    "resolution": item.resolution or "pending",
                }
                for item in exceptions
            ],
        }

    def _build_process_payload(self, cession_file: CessionFile) -> dict[str, Any]:
        file_type = self._build_detection_payload(cession_file)["file_type"]
        if file_type == "Fixed Leg":
            plan = [
                "Recompute fixed leg per Â§6.2 (ACT/365)",
                "Compare to file values",
                "Flag deviations > tolerance",
            ]
        elif file_type == "Settlement":
            plan = [
                "Parse settlement period, payment date, pensioner movement, indexation, legs, fee, interest and net amount",
                "Retrieve IRiS expected fixed and floating legs for the mapped contract-period",
                "Recompute net settlement as floating minus fixed plus signed fee and prior-period interest",
                "Create a settlement approval worklist item on match or a reconciliation review item on mismatch",
            ]
        elif file_type == "Pension Status":
            plan = [
                "Normalize pensioner status movements",
                "Apply SCD2 population changes",
                "Prepare downstream valuation deltas",
            ]
        elif file_type == "Mortality Report":
            plan = [
                "Validate mortality events against the reference pool",
                "Apply confirmed death updates",
                "Prepare experience impact output",
            ]
        else:
            plan = [
                "Normalize activity file structure",
                "Apply contract tolerance rules",
                "Prepare worklist actions for downstream review",
            ]
        return {
            "title": f"Processing {file_type}",
            "subtitle": "Click Continue to execute. Engine logic depends on file type.",
            "engine_plan": plan,
            "iris_note": "IRiS will compute before/after population, financial impact and anomaly detection on the next step.",
        }

    def _build_summary_payload(self, cession_file: CessionFile) -> dict[str, Any]:
        mapping = self._build_contract_mapping_payload(cession_file)
        detection = self._build_detection_payload(cession_file)
        exceptions = self.repository.list_file_exceptions(cession_file.id)
        worklist_items = self.repository.list_worklist_items_for_file(cession_file.id)
        settlement = self._mock_settlement_for_contract(mapping["contract_id"])
        file_type = detection["file_type"]

        resolved_exceptions = sum(1 for item in exceptions if item.resolution in {"accepted", "overridden"})
        overridden_total = sum(1 for item in exceptions if item.resolution == "overridden")
        summary: dict[str, Any] = {
            "file_id": cession_file.file_id,
            "contract_id": mapping["contract_id"],
            "file_type": file_type,
            "period": mapping["period"],
            "records_processed": cession_file.record_count or 0,
            "exceptions_resolved": resolved_exceptions,
            "exceptions_overridden": overridden_total,
            "worklist_items_created": len(worklist_items),
            "audit_trail_id": self._get_override(cession_file.file_id).get("pipeline_session_id"),
        }

        if file_type == "Fixed Leg":
            summary.update(
                {
                    "settlement_impact": {
                        "fixed_leg_adjustment": -132145,
                        "currency": mapping["currency"],
                        "settlement_id_created": settlement["settlement_id"],
                    },
                    "population_changes": None,
                    "liability_impact": 0,
                    "fixed_leg_recomputed": 8782055,
                    "net_settlement_amount": 8649910,
                    "insight": "recommendation: 1 cell deviates from Â§6.2 calc by 1.5% â€” accept AI correction.",
                }
            )
            return summary

        if file_type == "Settlement":
            reconciliation = self._build_settlement_reconciliation_payload(cession_file)
            settlement_id = reconciliation["settlement_id"] if reconciliation else settlement["settlement_id"]
            currency = reconciliation["currency"] if reconciliation else mapping["currency"]
            summary.update(
                {
                    "settlement_impact": {
                        "fixed_leg_adjustment": (
                            reconciliation["uploaded"]["fixed_leg"] - reconciliation["system"]["fixed_leg"]
                            if reconciliation
                            else 0
                        ),
                        "currency": currency,
                        "settlement_id_created": settlement_id,
                    },
                    "population_changes": None,
                    "liability_impact": None,
                    "fixed_leg_recomputed": None,
                    "net_settlement_amount": reconciliation["uploaded"]["net_settlement_amount"] if reconciliation else None,
                    "settlement_reconciliation": reconciliation,
                    "insight": (
                        "recommendation: approve settlement; uploaded fixed, floating and net values exactly match IRiS."
                        if reconciliation and reconciliation["decision"] == "accept"
                        else "recommendation: route to settlement reconciliation review; uploaded values do not exactly match IRiS expected values."
                    ),
                }
            )
            return summary

        if file_type == "Pension Status":
            processing_summary = self._get_override(cession_file.file_id).get("population_processing_summary") or {}
            settlement_summary = self._get_override(cession_file.file_id).get("settlement_processing_summary") or {}
            summary.update(
                {
                    "settlement_impact": (
                        {
                            "fixed_leg_adjustment": 0,
                            "currency": settlement_summary.get("currency"),
                            "settlement_id_created": settlement_summary.get("settlement_id"),
                        }
                        if settlement_summary
                        else None
                    ),
                    "population_changes": {
                        "new_deceased": processing_summary.get("new_deceased", 0),
                        "new_deferred": processing_summary.get("new_deferred", 0),
                        "new_active": processing_summary.get("new_active", 0),
                    },
                    "liability_impact": processing_summary.get("liability_impact", 0),
                    "fixed_leg_recomputed": settlement_summary.get("fixed_leg_amount"),
                    "net_settlement_amount": settlement_summary.get("net_amount"),
                    "insight": processing_summary.get(
                        "insight",
                        "recommendation: processed pension status movements will feed the next population and valuation cycle.",
                    ),
                }
            )
            return summary

        if file_type == "Mortality Report":
            summary.update(
                {
                    "settlement_impact": {
                        "fixed_leg_adjustment": 0,
                        "currency": mapping["currency"],
                        "settlement_id_created": "EXP-2025-Q1-031",
                    },
                    "population_changes": {
                        "confirmed_deaths": 12,
                        "pending_manual_review": 1,
                    },
                    "liability_impact": -11200000,
                    "fixed_leg_recomputed": None,
                    "net_settlement_amount": None,
                    "insight": "recommendation: 1 mortality event needs manual review before the experience report is published.",
                }
            )
            return summary

        summary.update(
            {
                "settlement_impact": None,
                "population_changes": {
                    "status_changes": 18,
                    "manual_follow_up": 2,
                },
                "liability_impact": -640000,
                "fixed_leg_recomputed": None,
                "net_settlement_amount": None,
                "insight": "recommendation: activity changes should route to Claims Ops for tolerance review before settlement refresh.",
            }
        )
        return summary

    def _build_worklist_payload(self, cession_file: CessionFile) -> dict[str, Any]:
        items = self.repository.list_worklist_items_for_file(cession_file.id)
        if items:
            return {
                "title": "Worklist Tasks Created",
                "subtitle": "Routed to owning teams with SLA",
                "items": [
                    {
                        "wl_id": item.wl_id,
                        "task": item.title,
                        "type": item.category or "Validation",
                        "team": item.assigned_role or "claims_ops",
                        "priority": item.priority,
                        "sla": self._sla_display(item.sla_deadline),
                        "description": item.description or "",
                    }
                    for item in items
                ],
            }

        if cession_file.file_type == "Fixed Leg" or "fixed_leg" in cession_file.filename.lower():
            return {
                "title": "Worklist Tasks Created",
                "subtitle": "Routed to owning teams with SLA",
                "items": [
                    {
                        "wl_id": f"WL-{cession_file.file_id}-VAL",
                        "task": "Resolve 2 critical validation errors",
                        "type": "Validation",
                        "team": "Claims Ops",
                        "priority": "high",
                        "sla": "2h",
                        "description": "Mock task seeded from screenshot correction because no linked worklist row exists yet.",
                    }
                ],
            }

        return {
            "title": "Worklist Tasks Created",
            "subtitle": "Routed to owning teams with SLA",
            "items": [],
        }

    def _build_audit_payload(self, cession_file: CessionFile) -> dict[str, Any]:
        db_events = self._load_cession_audit_events(cession_file)
        if db_events:
            return {
                "title": "Audit Trail",
                "subtitle": f"{len(db_events)} events captured",
                "items": db_events,
            }

        stored = self._get_override(cession_file.file_id)
        seeded_events = stored.get("audit_events", [])
        if seeded_events:
            events = seeded_events
        elif cession_file.file_type == "Fixed Leg" or "fixed_leg" in cession_file.filename.lower():
            base_time = cession_file.received_at or datetime.now(UTC)
            events = [
                {
                    "timestamp": self._to_iso(base_time),
                    "actor": "SFTP Listener",
                    "type": "System",
                    "action": "File received via SFTP",
                    "detail": "â€”",
                },
                {
                    "timestamp": self._to_iso(base_time),
                    "actor": "AI Classifier v3.2",
                    "type": "AI Agent",
                    "action": 'Classified as "Fixed Leg"',
                    "detail": "confidence 94%",
                },
                {
                    "timestamp": self._to_iso(base_time),
                    "actor": "AI Classifier v3.2",
                    "type": "AI Agent",
                    "action": "Identified cedant Bavarian Industrial Fund",
                    "detail": "confidence 99%",
                },
                {
                    "timestamp": self._to_iso(base_time),
                    "actor": "Pipeline Orchestrator",
                    "type": "System",
                    "action": "Mapped to LSC-2025-002 v1.0",
                    "detail": "â€”",
                },
            ]
        else:
            events = stored.get("audit_events", [])

        return {
            "title": "Audit Trail",
            "subtitle": f'{len(events)} events captured',
            "items": events,
        }

    def _ensure_records_and_exceptions(
        self,
        cession_file: CessionFile,
        content: str | None = None,
        *,
        force: bool = False,
    ) -> None:
        current_records = self.repository.list_file_records(cession_file.id)
        current_exceptions = self.repository.list_file_exceptions(cession_file.id)
        if current_records and not force:
            self._apply_exception_counts_to_file(cession_file)
            return

        detection = self._build_detection_payload(cession_file)
        mapping = self._build_contract_mapping_payload(cession_file)
        source_content = content if content is not None else self._get_override(cession_file.file_id).get("source_content_text", "")
        template_records = self._build_record_templates(cession_file, detection["file_type"], mapping["contract_id"], source_content or "")
        template_exceptions = self._build_exception_templates(cession_file, detection["file_type"], template_records)

        if force or not current_records:
            self.repository.replace_file_records(
                cession_file.id,
                [
                    CessionFileRecord(
                        cession_file_id=cession_file.id,
                        row_number=item["row_number"],
                        member_id=item.get("member_id"),
                        raw_data=json.dumps(item["raw_data"]),
                        mapped_data=json.dumps(item["mapped_data"]),
                        validation_status=item.get("validation_status"),
                        validation_issues=json.dumps(item.get("validation_issues", [])),
                    )
                    for item in template_records
                ],
            )
        if force or (not current_exceptions and template_exceptions):
            self.repository.replace_file_exceptions(
                cession_file.id,
                [
                    CessionFileException(
                        cession_file_id=cession_file.id,
                        row_number=item["row_number"],
                        field_name=item["field_name"],
                        severity=item["severity"],
                        issue_type=item["issue_type"],
                        description=item["description"],
                        current_value=item["current_value"],
                        ai_suggestion=item["ai_suggestion"],
                        ai_confidence=item["ai_confidence"],
                        resolution=item["resolution"],
                        resolved_at=datetime.now(UTC) if item["resolution"] in {"accepted", "overridden"} else None,
                    )
                    for item in template_exceptions
                ],
            )
        if cession_file.record_count in {None, 0}:
            cession_file.record_count = len(template_records)
        self._apply_exception_counts_to_file(cession_file)
        self.repository.update_cession_file(cession_file)

    def _clear_file_records_and_exceptions(self, cession_file: CessionFile) -> None:
        logger.info("Clearing cession validation artifacts after upstream pipeline change")
        logger.debug("Clearing records/exceptions file_id=%s", cession_file.file_id)
        self.repository.replace_file_records(cession_file.id, [])
        self.repository.replace_file_exceptions(cession_file.id, [])
        cession_file.critical_count = 0
        cession_file.warning_count = 0
        cession_file.error_count = 0
        self.repository.update_cession_file(cession_file)

    def _build_record_templates(
        self,
        cession_file: CessionFile,
        file_type: str,
        contract_id: str,
        content: str,
    ) -> list[dict[str, Any]]:
        if file_type == "Fixed Leg":
            parsed_rows = self._parse_csv_rows(content)
            if not parsed_rows:
                parsed_rows = [
                    {
                        "row_id": "100",
                        "period": "Q1-2025",
                        "fixed_leg_amount": "8914200",
                        "currency": "EUR",
                        "fee_amount": "412300",
                        "value_date": "2025-03-30",
                        "contract_id": contract_id,
                    },
                    {
                        "row_id": "237",
                        "period": "Q1-2025",
                        "fixed_leg_amount": "8914200",
                        "currency": "EUR",
                        "fee_amount": "412300",
                        "value_date": "2025-03-30",
                        "contract_id": contract_id,
                    },
                    {
                        "row_id": "374",
                        "period": "Q1-2025",
                        "fixed_leg_amount": "8914200",
                        "currency": "EUR",
                        "fee_amount": "412300",
                        "value_date": "2025-03-30",
                        "contract_id": contract_id,
                    },
                    {
                        "row_id": "511",
                        "period": "Q1-2025",
                        "fixed_leg_amount": "8914200",
                        "currency": "EUR",
                        "fee_amount": "412300",
                        "value_date": "2025-03-30",
                        "contract_id": contract_id,
                    },
                ]
            return [
                {
                    "row_number": int(item["row_id"]),
                    "raw_data": item,
                    "mapped_data": {
                        "period": item["period"],
                        "contract_id": contract_id,
                        "fixed_leg_amount": item["fixed_leg_amount"],
                        "currency": item["currency"],
                    },
                    "validation_status": "warning",
                    "validation_issues": [],
                }
                for item in parsed_rows
            ]

        if file_type == "Settlement":
            return self._build_settlement_record_templates(cession_file, contract_id, content)

        if file_type == "Pension Status":
            if not content.strip():
                logger.error("Pension Status records cannot be built without uploaded tabular content file_id=%s", cession_file.file_id)
                return []

            return self._build_pension_status_record_templates(contract_id, content)

        if file_type == "Mortality Report":
            return [
                {
                    "row_number": 101,
                    "member_id": "HLV-000101",
                    "raw_data": {
                        "member_id": "HLV-000101",
                        "death_date": "2025-03-04",
                        "cause_code": "NAT",
                        "verified_by": "Helvetia Admin",
                    },
                    "mapped_data": {
                        "contract_id": contract_id,
                        "member_id": "HLV-000101",
                        "status": "deceased",
                    },
                    "validation_status": "valid",
                    "validation_issues": [],
                },
                {
                    "row_number": 245,
                    "member_id": "HLV-000245",
                    "raw_data": {
                        "member_id": "HLV-000245",
                        "death_date": "2025-03-18",
                        "cause_code": "UNK",
                        "verified_by": "",
                    },
                    "mapped_data": {
                        "contract_id": contract_id,
                        "member_id": "HLV-000245",
                        "status": "deceased",
                    },
                    "validation_status": "warning",
                    "validation_issues": [],
                },
                {
                    "row_number": 317,
                    "member_id": "HLV-000317",
                    "raw_data": {
                        "member_id": "HLV-000317",
                        "death_date": "2025-03-20",
                        "cause_code": "NAT",
                        "verified_by": "Helvetia Admin",
                    },
                    "mapped_data": {
                        "contract_id": contract_id,
                        "member_id": "HLV-000317",
                        "status": "deceased",
                    },
                    "validation_status": "valid",
                    "validation_issues": [],
                },
            ]

        return [
            {
                "row_number": 100,
                "member_id": "MAP-000100",
                "raw_data": {
                    "member_id": "MAP-000100",
                    "activity_code": "DEFER",
                    "effective_date": "2025-03-31",
                },
                "mapped_data": {
                    "contract_id": contract_id,
                    "member_id": "MAP-000100",
                    "activity_code": "DEFER",
                },
                "validation_status": "warning",
                "validation_issues": [],
            },
            {
                "row_number": 240,
                "member_id": "MAP-000240",
                "raw_data": {
                    "member_id": "MAP-000240",
                    "activity_code": "SPOUSE_CHANGE",
                    "effective_date": "2025-03-31",
                },
                "mapped_data": {
                    "contract_id": contract_id,
                    "member_id": "MAP-000240",
                    "activity_code": "SPOUSE_CHANGE",
                },
                "validation_status": "critical",
                "validation_issues": [],
            },
        ]

    def _build_settlement_record_templates(
        self,
        cession_file: CessionFile,
        contract_id: str,
        content: str,
    ) -> list[dict[str, Any]]:
        logger.info("Building Settlement file reconciliation records")
        logger.debug("Settlement record build file_id=%s contract_id=%s", cession_file.file_id, contract_id)
        if not content.strip():
            logger.error("Settlement records cannot be built without uploaded tabular content file_id=%s", cession_file.file_id)
            return []

        contract = self.repository.get_contract(contract_id)
        if contract is None:
            logger.error("Settlement records cannot be built because contract_id=%s is missing", contract_id)
            return []

        parsed_rows = self._parse_upload_dict_rows(content)
        repair_context = self._build_settlement_repair_context(parsed_rows)
        templates: list[dict[str, Any]] = []
        for row_index, raw_data in enumerate(parsed_rows, start=1):
            row_number = self._settlement_row_number(raw_data, row_index)
            normalized_row = self._normalize_settlement_row(raw_data, repair_context)
            period_label = normalized_row["calculation_period"]
            payment_date = normalized_row["payment_date"]
            uploaded_fixed = normalized_row["fixed_leg"]
            uploaded_floating = normalized_row["floating_leg"]
            uploaded_fee = normalized_row["fee"]
            uploaded_interest = normalized_row["interest_prior_period"]
            uploaded_net = normalized_row["net_settlement_amount"]
            currency = self._settlement_currency(raw_data, contract.currency or "USD")
            unresolved_issues = list(normalized_row["exception_issues"])
            validation_issues = list(normalized_row["validation_issues"])
            reconciliation = None
            if (
                period_label
                and uploaded_fixed is not None
                and uploaded_floating is not None
                and uploaded_fee is not None
                and uploaded_interest is not None
                and uploaded_net is not None
            ):
                expected = self._expected_settlement_values(contract, period_label, uploaded_fee, uploaded_interest, cession_file)
                reconciliation = self._settlement_reconciliation_result(
                    contract,
                    cession_file,
                    period_label,
                    payment_date,
                    currency,
                    uploaded_fixed,
                    uploaded_floating,
                    uploaded_fee,
                    uploaded_interest,
                    uploaded_net,
                    expected,
                )

            templates.append(
                {
                    "row_number": row_number,
                    "raw_data": raw_data,
                    "mapped_data": {
                        "contract_id": contract_id,
                        "calculation_period": period_label,
                        "payment_date": payment_date.isoformat() if payment_date else None,
                        "pensioner_movement": normalized_row["pensioner_movement"],
                        "applicable_indexation_escalation": normalized_row["applicable_indexation_escalation"],
                        "fixed_leg": self._settlement_decimal_payload(uploaded_fixed),
                        "floating_leg": self._settlement_decimal_payload(uploaded_floating),
                        "fee": self._settlement_decimal_payload(uploaded_fee),
                        "interest_prior_period": self._settlement_decimal_payload(uploaded_interest),
                        "net_settlement_amount": self._settlement_decimal_payload(uploaded_net),
                        "currency": currency,
                        "settlement_reconciliation": reconciliation,
                        "agentic_fix_count": sum(1 for issue in validation_issues if issue.get("ai_suggestion")),
                    },
                    "validation_status": self._validation_status_from_issues(unresolved_issues),
                    "validation_issues": validation_issues,
                    "exception_issues": unresolved_issues,
                }
            )

        logger.info("Built Settlement reconciliation records")
        logger.debug("Settlement record templates file_id=%s rows=%s", cession_file.file_id, len(templates))
        return templates

    def _build_settlement_repair_context(self, parsed_rows: list[dict[str, str]]) -> dict[str, Any]:
        period_labels = [
            normalized
            for row in parsed_rows
            if (normalized := self._normalize_period_label(self._aliased_raw_value(row, "calculation_period")))
        ]
        payment_dates = [
            parsed_date
            for row in parsed_rows
            if (parsed_date := self._parse_flexible_date(self._aliased_raw_value(row, "payment_date")))
        ]
        pensioner_movements = [
            value
            for row in parsed_rows
            if (value := self._aliased_raw_value(row, "pensioner_movement"))
        ]
        indexation_values = [
            value
            for row in parsed_rows
            if (value := self._aliased_raw_value(row, "applicable_indexation_escalation"))
        ]
        return {
            "calculation_period": self._most_frequent_text(period_labels),
            "payment_date": self._most_frequent_date(payment_dates),
            "pensioner_movement": self._most_frequent_text(pensioner_movements),
            "applicable_indexation_escalation": self._most_frequent_text(indexation_values),
        }

    def _normalize_settlement_row(self, raw_data: dict[str, str], repair_context: dict[str, Any]) -> dict[str, Any]:
        validation_issues: list[dict[str, Any]] = []
        exception_issues: list[dict[str, Any]] = []

        calculation_period = self._normalize_period_label(self._aliased_raw_value(raw_data, "calculation_period"))
        calculation_period, period_issues = self._repair_settlement_text_field(
            field_name="calculation_period",
            raw_value=self._aliased_raw_value(raw_data, "calculation_period"),
            normalized_value=calculation_period,
            repair_value=repair_context.get("calculation_period"),
            missing_description="Calculation Period is required for Settlement files.",
            invalid_description="Calculation Period must identify a quarter such as Q1 2025.",
        )
        validation_issues.extend(period_issues["all"])
        exception_issues.extend(period_issues["unresolved"])

        payment_date = self._parse_flexible_date(self._aliased_raw_value(raw_data, "payment_date"))
        payment_date, payment_date_issues = self._repair_settlement_date_field(
            field_name="payment_date",
            raw_value=self._aliased_raw_value(raw_data, "payment_date"),
            normalized_value=payment_date,
            repair_value=repair_context.get("payment_date"),
            missing_description="Payment Date is required for Settlement files.",
            invalid_description="Payment Date must be a valid ISO date (YYYY-MM-DD).",
        )
        validation_issues.extend(payment_date_issues["all"])
        exception_issues.extend(payment_date_issues["unresolved"])

        pensioner_movement, movement_issues = self._repair_settlement_text_field(
            field_name="pensioner_movement",
            raw_value=self._aliased_raw_value(raw_data, "pensioner_movement"),
            normalized_value=self._aliased_raw_value(raw_data, "pensioner_movement") or None,
            repair_value=repair_context.get("pensioner_movement"),
            missing_description="Pensioner Movement is required for Settlement files.",
            invalid_description=None,
        )
        validation_issues.extend(movement_issues["all"])
        exception_issues.extend(movement_issues["unresolved"])

        applicable_indexation_escalation, indexation_issues = self._repair_settlement_text_field(
            field_name="applicable_indexation_escalation",
            raw_value=self._aliased_raw_value(raw_data, "applicable_indexation_escalation"),
            normalized_value=self._aliased_raw_value(raw_data, "applicable_indexation_escalation") or None,
            repair_value=repair_context.get("applicable_indexation_escalation"),
            missing_description="Applicable Indexation / Escalation is required for Settlement files.",
            invalid_description=None,
        )
        validation_issues.extend(indexation_issues["all"])
        exception_issues.extend(indexation_issues["unresolved"])

        amount_fields = {
            "fixed_leg": "Fixed Leg is required for Settlement files.",
            "floating_leg": "Floating Leg is required for Settlement files.",
            "fee": "Fee is required for Settlement files.",
            "interest_prior_period": "Interest on Over/Underpayment from Prior Period is required for Settlement files.",
            "net_settlement_amount": "Net Settlement Amount is required for Settlement files.",
        }
        normalized_amounts: dict[str, Decimal | None] = {}
        for field_name, missing_description in amount_fields.items():
            normalized_amounts[field_name], amount_issues = self._repair_settlement_amount_field(
                field_name=field_name,
                raw_value=self._aliased_raw_value(raw_data, field_name),
                missing_description=missing_description,
            )
            validation_issues.extend(amount_issues["all"])
            exception_issues.extend(amount_issues["unresolved"])

        return {
            "calculation_period": calculation_period,
            "payment_date": payment_date,
            "pensioner_movement": pensioner_movement,
            "applicable_indexation_escalation": applicable_indexation_escalation,
            "fixed_leg": normalized_amounts["fixed_leg"],
            "floating_leg": normalized_amounts["floating_leg"],
            "fee": normalized_amounts["fee"],
            "interest_prior_period": normalized_amounts["interest_prior_period"],
            "net_settlement_amount": normalized_amounts["net_settlement_amount"],
            "validation_issues": validation_issues,
            "exception_issues": exception_issues,
        }

    def _repair_settlement_text_field(
        self,
        *,
        field_name: str,
        raw_value: str,
        normalized_value: str | None,
        repair_value: str | None,
        missing_description: str,
        invalid_description: str | None,
    ) -> tuple[str | None, dict[str, list[dict[str, Any]]]]:
        all_issues: list[dict[str, Any]] = []
        unresolved: list[dict[str, Any]] = []
        normalized_text = str(normalized_value or "").strip() or None
        raw_text = str(raw_value or "").strip()
        if normalized_text:
            return normalized_text, {"all": all_issues, "unresolved": unresolved}
        if repair_value:
            issue = self._validation_issue(
                field_name,
                "critical",
                "missing_required_field" if not raw_text else "invalid_value",
                (
                    f"{SETTLEMENT_TARGET_HEADER_LABELS.get(field_name, field_name)} is missing; use the most frequent valid file value."
                    if not raw_text
                    else f"{SETTLEMENT_TARGET_HEADER_LABELS.get(field_name, field_name)} is invalid; use the most frequent valid file value."
                ),
                raw_text,
                str(repair_value),
                0.95,
            )
            all_issues.append(issue)
            unresolved.append(issue)
            return str(repair_value), {"all": all_issues, "unresolved": unresolved}

        issue_type = "missing_required_field" if not raw_text else "invalid_value"
        description = missing_description if not raw_text else (invalid_description or missing_description)
        issue = self._validation_issue(
            field_name,
            "critical",
            issue_type,
            description,
            raw_text,
        )
        all_issues.append(issue)
        unresolved.append(issue)
        return None, {"all": all_issues, "unresolved": unresolved}

    def _repair_settlement_date_field(
        self,
        *,
        field_name: str,
        raw_value: str,
        normalized_value: date | None,
        repair_value: date | None,
        missing_description: str,
        invalid_description: str,
    ) -> tuple[date | None, dict[str, list[dict[str, Any]]]]:
        all_issues: list[dict[str, Any]] = []
        unresolved: list[dict[str, Any]] = []
        raw_text = str(raw_value or "").strip()
        if normalized_value is not None:
            if raw_text and raw_text != normalized_value.isoformat():
                issue = self._validation_issue(
                    field_name,
                    "warning",
                    "date_format_normalization",
                    f"{SETTLEMENT_TARGET_HEADER_LABELS.get(field_name, field_name)} is not in ISO format (YYYY-MM-DD).",
                    raw_text,
                    normalized_value.isoformat(),
                    1.0,
                )
                all_issues.append(issue)
                unresolved.append(issue)
            return normalized_value, {"all": all_issues, "unresolved": unresolved}
        if repair_value is not None:
            issue = self._validation_issue(
                field_name,
                "critical",
                "missing_required_field" if not raw_text else "invalid_date",
                (
                    f"{SETTLEMENT_TARGET_HEADER_LABELS.get(field_name, field_name)} is missing; use the mode of the file date column."
                    if not raw_text
                    else f"{SETTLEMENT_TARGET_HEADER_LABELS.get(field_name, field_name)} is invalid; use the mode of the file date column."
                ),
                raw_text,
                repair_value.isoformat(),
                0.96,
            )
            all_issues.append(issue)
            unresolved.append(issue)
            return repair_value, {"all": all_issues, "unresolved": unresolved}

        issue = self._validation_issue(
            field_name,
            "critical",
            "missing_required_field" if not raw_text else "invalid_date",
            missing_description if not raw_text else invalid_description,
            raw_text,
        )
        all_issues.append(issue)
        unresolved.append(issue)
        return None, {"all": all_issues, "unresolved": unresolved}

    def _repair_settlement_amount_field(
        self,
        *,
        field_name: str,
        raw_value: str,
        missing_description: str,
    ) -> tuple[Decimal | None, dict[str, list[dict[str, Any]]]]:
        all_issues: list[dict[str, Any]] = []
        unresolved: list[dict[str, Any]] = []
        raw_text = str(raw_value or "").strip()
        parsed_amount = self._parse_settlement_decimal(raw_text)
        if parsed_amount is not None:
            normalized_amount = self._settlement_amount_text(parsed_amount)
            if raw_text and raw_text != normalized_amount:
                issue = self._validation_issue(
                    field_name,
                    "warning",
                    "amount_format_normalization",
                    f"{SETTLEMENT_TARGET_HEADER_LABELS.get(field_name, field_name)} contains currency or formatting and should be normalized to an integer amount.",
                    raw_text,
                    normalized_amount,
                    1.0,
                )
                all_issues.append(issue)
                unresolved.append(issue)
            return parsed_amount, {"all": all_issues, "unresolved": unresolved}

        issue = self._validation_issue(
            field_name,
            "critical",
            "missing_required_field" if not raw_text else "invalid_amount",
            missing_description if not raw_text else f"{field_name} must be a numeric settlement amount.",
            raw_text,
        )
        all_issues.append(issue)
        unresolved.append(issue)
        return None, {"all": all_issues, "unresolved": unresolved}

    def _most_frequent_text(self, values: list[str]) -> str | None:
        cleaned = [str(value).strip() for value in values if str(value).strip()]
        if not cleaned:
            return None
        return Counter(cleaned).most_common(1)[0][0]

    def _most_frequent_date(self, values: list[date]) -> date | None:
        if not values:
            return None
        return Counter(values).most_common(1)[0][0]

    def _parse_upload_dict_rows(self, content: str) -> list[dict[str, str]]:
        try:
            cleaned_content = content.lstrip("\ufeff").strip()
            reader = csv.DictReader(
                io.StringIO(cleaned_content),
                delimiter=self._detect_tabular_delimiter(cleaned_content),
            )
        except csv.Error:
            return []
        if reader.fieldnames is None:
            return []
        rows: list[dict[str, str]] = []
        for row in reader:
            normalized = {
                self._normalize_column_name(str(key or "")): str(value or "").strip()
                for key, value in row.items()
                if key is not None
            }
            if any(normalized.values()):
                rows.append(normalized)
        return rows

    def _original_upload_headers(self, content: str) -> list[str]:
        cleaned_content = content.lstrip("\ufeff").strip()
        if not cleaned_content:
            return []
        try:
            reader = csv.reader(io.StringIO(cleaned_content), delimiter=self._detect_tabular_delimiter(cleaned_content))
            headers = next(reader, [])
        except csv.Error:
            return []
        return [str(header).strip() for header in headers if str(header).strip()]

    def _settlement_row_number(self, raw_data: dict[str, str], fallback: int) -> int:
        row_id = raw_data.get("row_id") or raw_data.get("row_number") or raw_data.get("id")
        try:
            return int(str(row_id or "").strip())
        except ValueError:
            return fallback

    def _build_settlement_required_issues(self, raw_data: dict[str, str]) -> list[dict[str, Any]]:
        issues: list[dict[str, Any]] = []
        for field_name in REQUIRED_FIELDS_BY_FILE_TYPE["Settlement"]:
            value = self._aliased_raw_value(raw_data, field_name)
            if not value:
                issues.append(
                    self._validation_issue(
                        field_name,
                        "critical",
                        "missing_required_field",
                        f"{field_name} is required for Settlement files.",
                        value,
                    )
                )
        return issues

    def _settlement_reconciliation_result(
        self,
        contract: Contract,
        cession_file: CessionFile,
        period_label: str,
        payment_date: date | None,
        currency: str,
        uploaded_fixed: Decimal,
        uploaded_floating: Decimal,
        uploaded_fee: Decimal,
        uploaded_interest: Decimal,
        uploaded_net: Decimal,
        expected: dict[str, Any],
    ) -> dict[str, Any]:
        uploaded_recomputed_net = self._decimal_cents(uploaded_floating - uploaded_fixed + uploaded_fee + uploaded_interest)
        system_net = self._decimal_cents(expected["floating_leg"] - expected["fixed_leg"] + uploaded_fee + uploaded_interest)
        settlement_id = self._settlement_id_for(contract.contract_id, period_label)
        period_start, period_end = self._period_bounds(period_label)
        mismatches: list[dict[str, Any]] = []
        self._append_settlement_mismatch(mismatches, "fixed_leg", uploaded_fixed, expected["fixed_leg"], "fixed_leg_mismatch", "Uploaded Fixed Leg does not exactly match IRiS expected Fixed Leg.")
        self._append_settlement_mismatch(mismatches, "floating_leg", uploaded_floating, expected["floating_leg"], "floating_leg_mismatch", "Uploaded Floating Leg does not exactly match IRiS expected Floating Leg.")
        self._append_settlement_mismatch(mismatches, "net_settlement_amount", uploaded_net, uploaded_recomputed_net, "net_formula_mismatch", "Uploaded Net Settlement Amount does not equal floating minus fixed plus signed fee and interest.")
        self._append_settlement_mismatch(mismatches, "net_settlement_amount", uploaded_net, system_net, "net_reconciliation_mismatch", "Uploaded Net Settlement Amount does not exactly match IRiS expected Net Settlement Amount.")
        decision = "accept" if not mismatches else "review"
        logger.info("Settlement reconciliation decision computed")
        logger.debug(
            "Settlement reconciliation file_id=%s settlement_id=%s decision=%s expected_source=%s mismatches=%s",
            cession_file.file_id,
            settlement_id,
            decision,
            expected["source"],
            mismatches,
        )
        return {
            "settlement_id": settlement_id,
            "decision": decision,
            "calculation_period": period_label,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "payment_date": payment_date.isoformat() if payment_date else None,
            "currency": currency,
            "expected_source": expected["source"],
            "mock_expected": expected["mock_expected"],
            "uploaded": {
                "fixed_leg": self._settlement_decimal_payload(uploaded_fixed),
                "floating_leg": self._settlement_decimal_payload(uploaded_floating),
                "fee": self._settlement_decimal_payload(uploaded_fee),
                "interest_prior_period": self._settlement_decimal_payload(uploaded_interest),
                "net_settlement_amount": self._settlement_decimal_payload(uploaded_net),
                "recomputed_net": self._settlement_decimal_payload(uploaded_recomputed_net),
            },
            "system": {
                "fixed_leg": self._settlement_decimal_payload(expected["fixed_leg"]),
                "floating_leg": self._settlement_decimal_payload(expected["floating_leg"]),
                "fee": self._settlement_decimal_payload(uploaded_fee),
                "interest_prior_period": self._settlement_decimal_payload(uploaded_interest),
                "net_settlement_amount": self._settlement_decimal_payload(system_net),
            },
            "mismatches": mismatches,
        }

    def _append_settlement_mismatch(
        self,
        mismatches: list[dict[str, Any]],
        field_name: str,
        uploaded: Decimal,
        expected: Decimal,
        issue_type: str,
        message: str,
    ) -> None:
        if self._decimal_cents(uploaded) == self._decimal_cents(expected):
            return
        mismatches.append(
            {
                "field": field_name,
                "uploaded": self._settlement_decimal_payload(uploaded),
                "expected": self._settlement_decimal_payload(expected),
                "issue_type": issue_type,
                "message": message,
            }
        )

    def _expected_settlement_values(
        self,
        contract: Contract,
        period_label: str,
        uploaded_fee: Decimal,
        uploaded_interest: Decimal,
        cession_file: CessionFile | None = None,
    ) -> dict[str, Any]:
        logger.info("Retrieving expected settlement values")
        logger.debug("Expected settlement lookup contract_id=%s period=%s", contract.contract_id, period_label)
        period_start, period_end = self._period_bounds(period_label)
        tracked = self._find_tracked_settlement_expectation(contract.contract_id, period_start, period_end, cession_file)
        if tracked:
            logger.info("Using tracked settlement register row for expected settlement values")
            logger.debug("Tracked settlement expectation contract_id=%s settlement_id=%s", contract.contract_id, tracked["settlement_id"])
            fixed_leg = self._decimal_cents(tracked.get("fixed_leg_amount"))
            floating_leg = self._decimal_cents(tracked.get("floating_leg_amount"))
            return {
                "fixed_leg": fixed_leg,
                "floating_leg": floating_leg,
                "net_settlement_amount": self._decimal_cents(floating_leg - fixed_leg + uploaded_fee + uploaded_interest),
                "source": "existing settlement register",
                "mock_expected": False,
            }

        current_population = self.repository.list_current_population_for_contract(contract.contract_id)
        eligible_population = [row for row in current_population if (row.status or "").lower() in {"active", "deferred"}]
        if self._population_has_settlement_coverage(contract, current_population, eligible_population):
            logger.info("Using contract terms and current population for expected settlement values")
            fixed_leg = self._decimal_cents(self._fixed_leg_from_contract(contract, period_start, period_end))
            floating_leg = self._decimal_cents(self._floating_leg_from_population(contract.contract_id))
            return {
                "fixed_leg": fixed_leg,
                "floating_leg": floating_leg,
                "net_settlement_amount": self._decimal_cents(floating_leg - fixed_leg + uploaded_fee + uploaded_interest),
                "source": "contract terms and current policy_register population",
                "mock_expected": False,
            }

        if current_population:
            logger.info("MOCK IMPLEMENTATION: current policy_register sample is incomplete for settlement expectation")
            logger.debug(
                "Incomplete settlement population contract_id=%s current_rows=%s eligible_rows=%s lives_count=%s",
                contract.contract_id,
                len(current_population),
                len(eligible_population),
                contract.lives_count,
            )
        logger.info("MOCK IMPLEMENTATION: expected settlement values are not tracked for contract-period")
        logger.debug("Mock expected settlement fallback contract_id=%s period=%s", contract.contract_id, period_label)
        fixed_leg = self._decimal_cents(self._fixed_leg_from_contract(contract, period_start, period_end))
        floating_leg = self._decimal_cents(fixed_leg * Decimal(str(1 + self._calculation_factor(contract.contract_id, "settlement"))))
        settlement_id = self._settlement_id_for(contract.contract_id, period_label)
        fallback = {
            "contract_id": contract.contract_id,
            "period_label": period_label,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "fixed_leg_amount": self._decimal_payload(fixed_leg),
            "floating_leg_amount": self._decimal_payload(floating_leg),
            "net_amount": self._decimal_payload(floating_leg - fixed_leg + uploaded_fee + uploaded_interest),
            "currency": contract.currency or "USD",
            "source": "MOCK IMPLEMENTATION - deterministic settlement expectation",
        }
        self._store_mock_settlement_expectation(settlement_id, fallback)
        return {
            "fixed_leg": fixed_leg,
            "floating_leg": floating_leg,
            "net_settlement_amount": self._decimal_cents(floating_leg - fixed_leg + uploaded_fee + uploaded_interest),
            "source": "MOCK IMPLEMENTATION - deterministic settlement expectation",
            "mock_expected": True,
        }

    def _find_tracked_settlement_expectation(
        self,
        contract_id: str,
        period_start: date,
        period_end: date,
        cession_file: CessionFile | None,
    ) -> dict[str, Any] | None:
        for settlement in self.repository.list_settlements():
            if settlement.contract_id != contract_id:
                continue
            if settlement.period_start != period_start or settlement.period_end != period_end:
                continue
            if cession_file and settlement.cession_file_id == cession_file.id:
                continue
            return self._serialize_settlement_model(settlement)

        return next(
            (
                item
                for item in self._load_settlement_seed_rows()
                if item.get("contract_id") == contract_id
                and item.get("period_start") == period_start.isoformat()
                and item.get("period_end") == period_end.isoformat()
            ),
            None,
        )

    def _population_has_settlement_coverage(
        self,
        contract: Contract,
        current_population: list[PolicyRegister],
        eligible_population: list[PolicyRegister],
    ) -> bool:
        if not current_population:
            return False
        expected_lives = int(contract.lives_count or 0)
        if expected_lives <= 0:
            return len(eligible_population) >= 100
        return len(current_population) >= max(int(expected_lives * 0.8), 1)

    def _build_settlement_reconciliation_payload(self, cession_file: CessionFile) -> dict[str, Any] | None:
        records = self.repository.list_file_records(cession_file.id)
        if not records:
            stored_summary = self._get_override(cession_file.file_id).get("settlement_processing_summary") or {}
            return stored_summary.get("settlement_reconciliation")
        contract = self.repository.get_contract(cession_file.contract_id) if cession_file.contract_id else None
        for record in records:
            if contract:
                recomputed = self._build_settlement_reconciliation_from_record(cession_file, record, contract)
                if recomputed:
                    return recomputed
            mapped_data = json.loads(record.mapped_data or "{}")
            reconciliation = mapped_data.get("settlement_reconciliation")
            if reconciliation:
                return reconciliation
        return None

    def _build_settlement_reconciliation_from_record(
        self,
        cession_file: CessionFile,
        record: CessionFileRecord,
        contract: Contract,
    ) -> dict[str, Any] | None:
        raw_data = json.loads(record.raw_data or "{}")
        mapped_data = json.loads(record.mapped_data or "{}")
        return self._build_settlement_reconciliation_from_payload(cession_file, contract, raw_data, mapped_data)

    def _build_settlement_reconciliation_from_payload(
        self,
        cession_file: CessionFile,
        contract: Contract,
        raw_data: dict[str, Any],
        mapped_data: dict[str, Any],
    ) -> dict[str, Any] | None:
        period_raw = self._aliased_raw_value(raw_data, "calculation_period") or mapped_data.get("calculation_period")
        period_label = self._normalize_period_label(period_raw)
        if not period_label:
            return None

        payment_date_raw = self._aliased_raw_value(raw_data, "payment_date") or mapped_data.get("payment_date")
        payment_date = self._parse_flexible_date(payment_date_raw)
        uploaded_fixed = self._settlement_amount_from_record(raw_data, mapped_data, "fixed_leg")
        uploaded_floating = self._settlement_amount_from_record(raw_data, mapped_data, "floating_leg")
        uploaded_fee = self._settlement_amount_from_record(raw_data, mapped_data, "fee")
        uploaded_interest = self._settlement_amount_from_record(raw_data, mapped_data, "interest_prior_period")
        uploaded_net = self._settlement_amount_from_record(raw_data, mapped_data, "net_settlement_amount")
        if None in {uploaded_fixed, uploaded_floating, uploaded_fee, uploaded_interest, uploaded_net}:
            return None

        currency = self._settlement_currency(raw_data, contract.currency or "USD")
        expected = self._expected_settlement_values(contract, period_label, uploaded_fee, uploaded_interest, cession_file)
        return self._settlement_reconciliation_result(
            contract,
            cession_file,
            period_label,
            payment_date,
            currency,
            uploaded_fixed,
            uploaded_floating,
            uploaded_fee,
            uploaded_interest,
            uploaded_net,
            expected,
        )

    def _settlement_amount_from_record(
        self,
        raw_data: dict[str, str],
        mapped_data: dict[str, Any],
        field_name: str,
    ) -> Decimal | None:
        parsed = self._parse_settlement_decimal(self._aliased_raw_value(raw_data, field_name))
        if parsed is not None:
            return parsed
        value = mapped_data.get(field_name)
        if value is None:
            return None
        return self._decimal_cents(value)

    def _apply_filetype_exception_resolutions(
        self,
        cession_file: CessionFile,
        file_type: str,
        updated_exceptions: list[CessionFileException],
    ) -> None:
        if file_type == "Settlement":
            self._apply_settlement_exception_resolutions(cession_file, updated_exceptions)
            return
        # Placeholder for future file-type-specific resolution mutation.

    def _apply_settlement_exception_resolutions(
        self,
        cession_file: CessionFile,
        updated_exceptions: list[CessionFileException],
    ) -> None:
        if not cession_file.contract_id:
            return
        contract = self.repository.get_contract(cession_file.contract_id)
        if contract is None:
            return

        records_by_row = {record.row_number: record for record in self.repository.list_file_records(cession_file.id)}
        records_to_update: list[CessionFileRecord] = []
        for exception in updated_exceptions:
            if exception.resolution not in {"accepted", "overridden"}:
                continue
            record = records_by_row.get(exception.row_number)
            if record is None:
                continue
            raw_data = json.loads(record.raw_data or "{}")
            mapped_data = json.loads(record.mapped_data or "{}")
            validation_issues = json.loads(record.validation_issues or "[]")

            self._apply_settlement_field_override(raw_data, mapped_data, exception.field_name, exception.current_value)
            mapped_data["settlement_reconciliation"] = self._build_settlement_reconciliation_from_payload(
                cession_file,
                contract,
                raw_data,
                mapped_data,
            )
            remaining_issues = [
                issue
                for issue in validation_issues
                if not (
                    issue.get("field_name") == exception.field_name
                    and issue.get("issue_type") == exception.issue_type
                )
            ]
            record.raw_data = json.dumps(raw_data)
            record.mapped_data = json.dumps(mapped_data)
            record.validation_issues = json.dumps(remaining_issues)
            record.validation_status = self._validation_status_from_issues(remaining_issues)
            records_to_update.append(record)

        if records_to_update:
            self.repository.update_file_records(records_to_update)

    def _apply_settlement_field_override(
        self,
        raw_data: dict[str, Any],
        mapped_data: dict[str, Any],
        field_name: str,
        value: Any,
    ) -> None:
        serialized_value = self._settlement_override_value(field_name, value)
        if serialized_value is None:
            return

        mapped_data[field_name] = serialized_value
        normalized_aliases = [self._normalize_column_name(alias) for alias in COLUMN_ALIASES_BY_FIELD.get(field_name, (field_name,))]
        updated_any_alias = False
        for alias in normalized_aliases:
            if alias in raw_data:
                raw_data[alias] = self._settlement_override_raw_text(field_name, serialized_value)
                updated_any_alias = True
        if not updated_any_alias:
            raw_data[self._normalize_column_name(field_name)] = self._settlement_override_raw_text(field_name, serialized_value)

    def _settlement_override_value(self, field_name: str, value: Any) -> Any:
        if field_name == "calculation_period":
            normalized = self._normalize_period_label(value)
            return normalized or (str(value).strip() if value is not None else None)
        if field_name == "payment_date":
            parsed = self._parse_flexible_date(value)
            return parsed.isoformat() if parsed else (str(value).strip() if value is not None else None)
        if field_name in {"pensioner_movement", "applicable_indexation_escalation", "currency"}:
            text = str(value or "").strip()
            return text.upper() if field_name == "currency" else text
        if field_name in {"fixed_leg", "floating_leg", "fee", "interest_prior_period", "net_settlement_amount"}:
            parsed_amount = self._parse_settlement_decimal(value)
            return self._settlement_decimal_payload(parsed_amount) if parsed_amount is not None else None
        return str(value or "").strip() or None

    def _settlement_override_raw_text(self, field_name: str, value: Any) -> str:
        if value is None:
            return ""
        if field_name in {"fixed_leg", "floating_leg", "fee", "interest_prior_period", "net_settlement_amount"}:
            parsed_amount = self._parse_settlement_decimal(value)
            return self._settlement_amount_text(parsed_amount) if parsed_amount is not None else str(value)
        return str(value)

    def _store_mock_settlement_expectation(self, settlement_id: str, payload: dict[str, Any]) -> None:
        store = self._read_settlement_override_store()
        fallbacks = deepcopy(store.get(SETTLEMENT_EXPECTED_FALLBACKS_KEY, {}))
        fallbacks[settlement_id] = payload
        store[SETTLEMENT_EXPECTED_FALLBACKS_KEY] = fallbacks
        self._write_settlement_override_store(store)

    def _aliased_raw_value(self, raw_data: dict[str, str], field_name: str) -> str:
        for alias in COLUMN_ALIASES_BY_FIELD.get(field_name, (field_name,)):
            normalized_alias = self._normalize_column_name(alias)
            if normalized_alias in raw_data:
                return str(raw_data.get(normalized_alias) or "").strip()
        return ""

    def _settlement_currency(self, raw_data: dict[str, str], default_currency: str) -> str:
        explicit = self._aliased_raw_value(raw_data, "currency")
        if explicit:
            return explicit.upper()
        for field_name in ("fixed_leg", "floating_leg", "fee", "interest_prior_period", "net_settlement_amount"):
            value = self._aliased_raw_value(raw_data, field_name).upper()
            compact_value = value.replace(" ", "")
            currency_markers = (
                ("CAD", ("CAD", "CA$", "C$")),
                ("AUD", ("AUD", "A$")),
                ("NZD", ("NZD", "NZ$")),
                ("USD", ("USD", "US$")),
                ("GBP", ("GBP", "£")),
                ("EUR", ("EUR", "€")),
                ("CHF", ("CHF",)),
            )
            for currency, markers in currency_markers:
                if any(marker in compact_value for marker in markers):
                    return currency
            match = re.search(r"\b[A-Z]{3}\b", value)
            if match:
                return match.group(0)
            if "£" in value:
                return "GBP"
            if "€" in value:
                return "EUR"
            if "$" in value:
                return "USD"
        return default_currency

    def _parse_settlement_decimal(self, value: Any) -> Decimal | None:
        text = str(value or "").strip()
        if not text:
            return None
        is_parenthesized_negative = text.startswith("(") and text.endswith(")")
        is_prefixed_negative = text.startswith("-")
        cleaned = text.strip("()")
        cleaned = re.sub(r"(CA|US|NZ|AU|C|A)\$", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\b[A-Z]{2,3}\b", "", cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.replace(",", "").replace("£", "").replace("$", "").replace("€", "").replace(" ", "")
        match = re.search(r"[-+]?\d+(?:\.\d+)?", cleaned)
        if not match:
            return None
        try:
            value_decimal = Decimal(match.group(0))
        except InvalidOperation:
            return None
        if is_parenthesized_negative or is_prefixed_negative:
            value_decimal = -abs(value_decimal)
        return self._decimal_cents(value_decimal)

    def _decimal_cents(self, value: Any) -> Decimal:
        try:
            decimal_value = value if isinstance(value, Decimal) else Decimal(str(value or "0"))
        except (InvalidOperation, ValueError):
            decimal_value = Decimal("0")
        return decimal_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _decimal_payload(self, value: Decimal | float | int | None) -> float | None:
        if value is None:
            return None
        return float(self._decimal_cents(value))

    def _settlement_decimal_payload(self, value: Decimal | float | int | None) -> int | float | None:
        if value is None:
            return None
        normalized = self._decimal_cents(value)
        return int(normalized) if normalized == normalized.to_integral_value() else float(normalized)

    def _settlement_amount_text(self, value: Decimal | float | int | None) -> str:
        if value is None:
            return ""
        normalized = self._decimal_cents(value)
        return str(int(normalized)) if normalized == normalized.to_integral_value() else format(normalized, "f")

    def _parse_flexible_date(self, value: Any) -> date | None:
        text = str(value or "").strip()
        if not text:
            return None
        text = re.sub(r"\([^)]*\)", "", text).strip()
        text = re.sub(r"\s+", " ", text)
        parsed_iso = self._parse_iso_date(text)
        if parsed_iso:
            return parsed_iso
        for date_format in (
            "%Y/%m/%d",
            "%Y.%m.%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%d-%m-%Y",
            "%m-%d-%Y",
            "%d.%m.%Y",
            "%d %b %Y",
            "%d %B %Y",
        ):
            try:
                return datetime.strptime(text, date_format).date()
            except ValueError:
                continue
        return None

    def _build_pension_status_record_templates(self, contract_id: str, content: str) -> list[dict[str, Any]]:
        if not content.strip():
            logger.debug("Pension Status upload has no content to parse contract_id=%s", contract_id)
            return []

        try:
            upload_frame = pd.read_csv(io.StringIO(content), dtype=str).fillna("")
        except Exception as exc:
            logger.error("Pension Status upload could not be parsed with pandas contract_id=%s", contract_id)
            raise IrisAPIError(400, "Invalid pension status file", "Unable to parse the uploaded tabular file") from exc

        if upload_frame.empty:
            return []

        upload_frame.columns = [self._normalize_column_name(str(column)) for column in upload_frame.columns]
        upload_frame = upload_frame.reset_index(drop=True)
        upload_frame["row_number"] = upload_frame.index + 1
        normalized_frame = self._normalize_pension_status_upload_frame(upload_frame)

        member_ids = normalized_frame["member_id"].dropna().astype(str).str.strip()
        current_rows = self.repository.list_current_population_for_members(contract_id, member_ids[member_ids != ""].tolist())
        current_frame = self._population_rows_to_frame(current_rows)
        comparison_frame = normalized_frame.merge(
            current_frame,
            how="left",
            left_on="member_id",
            right_on="current_member_id",
        )

        templates: list[dict[str, Any]] = []
        for record in comparison_frame.to_dict(orient="records"):
            row_number = int(record["row_number"])
            raw_data = self._raw_upload_row(upload_frame, row_number)
            validation_issues = self._build_pension_status_validation_issues(record)
            normalized_row = self._population_row_from_pandas_record(record)
            templates.append(
                {
                    "row_number": row_number,
                    "member_id": normalized_row.member_id if normalized_row else str(record.get("member_id") or ""),
                    "raw_data": raw_data,
                    "mapped_data": self._serialize_population_row_for_pipeline(contract_id, normalized_row),
                    "validation_status": self._validation_status_from_issues(validation_issues),
                    "validation_issues": validation_issues,
                }
            )
        return templates

    def _normalize_pension_status_upload_frame(self, upload_frame: pd.DataFrame) -> pd.DataFrame:
        normalized = pd.DataFrame(index=upload_frame.index)
        normalized["row_number"] = upload_frame["row_number"]
        normalized["member_id"] = self._aliased_upload_series(upload_frame, ("member_id", "pensioner_ref"))
        normalized["policy_id"] = self._aliased_upload_series(upload_frame, ("policy_id",))
        normalized["date_of_birth_raw"] = self._aliased_upload_series(upload_frame, ("date_of_birth", "dob"))
        normalized["date_of_birth"] = pd.to_datetime(normalized["date_of_birth_raw"], errors="coerce").dt.date
        normalized["gender_raw"] = self._aliased_upload_series(upload_frame, ("gender",))
        normalized["gender"] = normalized["gender_raw"].str.upper().replace({"MALE": "M", "FEMALE": "F"})
        normalized["smoker_status"] = self._aliased_upload_series(upload_frame, ("smoker_status",))
        normalized["postcode"] = self._aliased_upload_series(upload_frame, ("postcode",))
        normalized["annual_pension_raw"] = self._aliased_upload_series(upload_frame, ("annual_pension", "annuity_amount"))
        normalized["annual_pension"] = pd.to_numeric(
            normalized["annual_pension_raw"].str.replace(",", "", regex=False),
            errors="coerce",
        )
        normalized["pension_currency"] = self._aliased_upload_series(upload_frame, ("pension_currency", "currency")).str.upper()
        normalized.loc[normalized["pension_currency"] == "", "pension_currency"] = "GBP"
        normalized["escalation_type"] = self._aliased_upload_series(upload_frame, ("escalation_type", "indexation_basis"))
        normalized["escalation_rate_raw"] = self._aliased_upload_series(upload_frame, ("escalation_rate",))
        normalized["escalation_rate"] = pd.to_numeric(normalized["escalation_rate_raw"], errors="coerce")
        normalized["status_raw"] = self._aliased_upload_series(upload_frame, ("status",))
        normalized["status"] = normalized["status_raw"].str.lower()
        normalized.loc[normalized["status"] == "", "status"] = "active"
        normalized["date_of_death_raw"] = self._aliased_upload_series(upload_frame, ("date_of_death", "death_date"))
        normalized["date_of_death"] = pd.to_datetime(normalized["date_of_death_raw"], errors="coerce").dt.date
        normalized["commencement_date_raw"] = self._aliased_upload_series(upload_frame, ("commencement_date",))
        normalized["commencement_date"] = pd.to_datetime(normalized["commencement_date_raw"], errors="coerce").dt.date
        normalized["effective_from_raw"] = self._aliased_upload_series(upload_frame, ("effective_from",))
        normalized["effective_from"] = pd.to_datetime(normalized["effective_from_raw"], errors="coerce").dt.date
        normalized["verification_reference"] = self._aliased_upload_series(upload_frame, ("verification_reference", "verified_by"))
        return normalized

    def _aliased_upload_series(self, upload_frame: pd.DataFrame, aliases: tuple[str, ...]) -> pd.Series:
        for alias in aliases:
            if alias in upload_frame.columns:
                return upload_frame[alias].astype(str).str.strip()
        return pd.Series([""] * len(upload_frame), index=upload_frame.index, dtype="string")

    def _population_rows_to_frame(self, rows: list[PolicyRegister]) -> pd.DataFrame:
        if not rows:
            return pd.DataFrame(
                columns=[
                    "current_member_id",
                    "current_policy_id",
                    "current_date_of_birth",
                    "current_gender",
                    "current_smoker_status",
                    "current_postcode",
                    "current_annual_pension",
                    "current_pension_currency",
                    "current_escalation_type",
                    "current_escalation_rate",
                    "current_status",
                    "current_date_of_death",
                    "current_commencement_date",
                    "current_effective_from",
                ]
            )
        return pd.DataFrame(
            [
                {
                    "current_member_id": row.member_id,
                    "current_policy_id": row.policy_id,
                    "current_date_of_birth": row.date_of_birth,
                    "current_gender": row.gender,
                    "current_smoker_status": row.smoker_status,
                    "current_postcode": row.postcode,
                    "current_annual_pension": float(row.annual_pension or 0),
                    "current_pension_currency": row.pension_currency or "GBP",
                    "current_escalation_type": row.escalation_type,
                    "current_escalation_rate": self._float_or_none(row.escalation_rate),
                    "current_status": row.status,
                    "current_date_of_death": row.date_of_death,
                    "current_commencement_date": row.commencement_date,
                    "current_effective_from": row.effective_from,
                }
                for row in rows
            ]
        )

    def _raw_upload_row(self, upload_frame: pd.DataFrame, row_number: int) -> dict[str, str]:
        rows = upload_frame.loc[upload_frame["row_number"] == row_number]
        if rows.empty:
            return {}
        return {
            key: value
            for key, value in rows.iloc[0].drop(labels=["row_number"], errors="ignore").astype(str).to_dict().items()
        }

    def _build_pension_status_validation_issues(self, record: dict[str, Any]) -> list[dict[str, Any]]:
        issues: list[dict[str, Any]] = []
        member_id = str(record.get("member_id") or "").strip()
        status = str(record.get("status") or "").strip().lower()
        current_member_id = record.get("current_member_id")
        current_status = str(record.get("current_status") or "").strip().lower()

        self._append_required_issue(issues, record, "member_id", member_id)
        self._append_required_issue(issues, record, "date_of_birth", record.get("date_of_birth_raw"), record.get("current_date_of_birth"))
        self._append_required_issue(issues, record, "gender", record.get("gender_raw"), record.get("current_gender"))
        self._append_required_issue(issues, record, "annual_pension", record.get("annual_pension_raw"), record.get("current_annual_pension"))
        self._append_required_issue(issues, record, "status", record.get("status_raw"), current_status or "active")

        if record.get("date_of_birth_raw") and pd.isna(record.get("date_of_birth")):
            issues.append(self._validation_issue("date_of_birth", "critical", "invalid_date", "date_of_birth must be a valid ISO date (YYYY-MM-DD).", record.get("date_of_birth_raw")))
        if record.get("gender_raw") and record.get("gender") not in {"M", "F"}:
            issues.append(self._validation_issue("gender", "critical", "invalid_gender", "gender must be M or F.", record.get("gender_raw")))
        if record.get("annual_pension_raw") and pd.isna(record.get("annual_pension")):
            issues.append(self._validation_issue("annual_pension", "critical", "invalid_number", "annual_pension must be numeric.", record.get("annual_pension_raw")))
        if status not in PENSION_STATUS_ALLOWED_STATUSES:
            issues.append(
                self._validation_issue(
                    "status",
                    "critical",
                    "invalid_status",
                    "status must be active, deferred, or deceased for Pension Status files.",
                    record.get("status_raw"),
                    current_status if current_status in PENSION_STATUS_ALLOWED_STATUSES else "active",
                    0.84,
                )
            )
        if member_id and pd.isna(current_member_id):
            issues.append(
                self._validation_issue(
                    "member_id",
                    "critical",
                    "member_not_in_contract",
                    "Member does not exist in the current population for this mapped contract.",
                    member_id,
                )
            )
        if status == "deceased" and (not record.get("date_of_death_raw") or pd.isna(record.get("date_of_death"))):
            issues.append(
                self._validation_issue(
                    "date_of_death",
                    "critical",
                    "missing_death_date",
                    "A deceased movement requires date_of_death before policy_register can be updated.",
                    record.get("date_of_death_raw"),
                )
            )
        if status == "deceased" and record.get("date_of_death_raw") and pd.isna(record.get("date_of_death")):
            issues.append(self._validation_issue("date_of_death", "critical", "invalid_date", "date_of_death must be a valid ISO date (YYYY-MM-DD).", record.get("date_of_death_raw")))
        if current_status == "deceased" and status != "deceased":
            issues.append(
                self._validation_issue(
                    "status",
                    "critical",
                    "invalid_status_regression",
                    "Current population is deceased; a non-deceased status requires manual contract evidence.",
                    record.get("status_raw"),
                )
            )
        if not pd.isna(record.get("current_date_of_birth")) and not pd.isna(record.get("date_of_birth")) and record.get("date_of_birth") != record.get("current_date_of_birth"):
            issues.append(
                self._validation_issue(
                    "date_of_birth",
                    "warning",
                    "static_field_mismatch",
                    "date_of_birth differs from the current policy_register row for this contract.",
                    record.get("date_of_birth_raw"),
                    str(record.get("current_date_of_birth")),
                    0.86,
                )
            )
        if record.get("current_gender") and record.get("gender") and record.get("gender") != record.get("current_gender"):
            issues.append(
                self._validation_issue(
                    "gender",
                    "warning",
                    "static_field_mismatch",
                    "gender differs from the current policy_register row for this contract.",
                    record.get("gender_raw"),
                    record.get("current_gender"),
                    0.86,
                )
            )
        if not pd.isna(record.get("annual_pension")) and not pd.isna(record.get("current_annual_pension")):
            current_amount = float(record.get("current_annual_pension") or 0)
            uploaded_amount = float(record.get("annual_pension") or 0)
            if abs(current_amount - uploaded_amount) > 0.01:
                issues.append(
                    self._validation_issue(
                        "annual_pension",
                        "warning",
                        "static_field_mismatch",
                        "annual_pension differs from the current policy_register row for this contract.",
                        record.get("annual_pension_raw"),
                        str(current_amount),
                        0.82,
                    )
                )
        return issues

    def _append_required_issue(
        self,
        issues: list[dict[str, Any]],
        record: dict[str, Any],
        field_name: str,
        value: Any,
        ai_suggestion: Any | None = None,
    ) -> None:
        if str(value or "").strip():
            return
        issues.append(
            self._validation_issue(
                field_name,
                "critical",
                "missing_required_field",
                f"{field_name} is required.",
                value,
                ai_suggestion,
                0.86 if ai_suggestion not in {None, ""} and not pd.isna(ai_suggestion) else None,
            )
        )

    def _validation_issue(
        self,
        field_name: str,
        severity: str,
        issue_type: str,
        description: str,
        current_value: Any,
        ai_suggestion: Any | None = None,
        ai_confidence: float | None = None,
    ) -> dict[str, Any]:
        return {
            "field_name": field_name,
            "severity": severity,
            "issue_type": issue_type,
            "description": description,
            "current_value": "" if current_value is None or pd.isna(current_value) else str(current_value),
            "ai_suggestion": None if ai_suggestion is None or pd.isna(ai_suggestion) else str(ai_suggestion),
            "ai_confidence": ai_confidence,
        }

    def _population_row_from_pandas_record(self, record: dict[str, Any]) -> PopulationCsvNormalizedRow | None:
        member_id = str(record.get("member_id") or "").strip()
        if not member_id or pd.isna(record.get("date_of_birth")) or record.get("gender") not in {"M", "F"} or pd.isna(record.get("annual_pension")):
            return None
        status = str(record.get("status") or "active").strip().lower()
        if status not in PENSION_STATUS_ALLOWED_STATUSES:
            return None
        return PopulationCsvNormalizedRow(
            member_id=member_id,
            policy_id=str(record.get("policy_id") or "").strip() or (None if pd.isna(record.get("current_policy_id")) else str(record.get("current_policy_id") or "").strip() or None),
            date_of_birth=record["date_of_birth"],
            gender=record["gender"],
            smoker_status=str(record.get("smoker_status") or "").strip() or (None if pd.isna(record.get("current_smoker_status")) else record.get("current_smoker_status")),
            postcode=str(record.get("postcode") or "").strip() or (None if pd.isna(record.get("current_postcode")) else record.get("current_postcode")),
            annual_pension=Decimal(str(record["annual_pension"])),
            pension_currency=str(record.get("pension_currency") or "GBP").strip().upper() or "GBP",
            escalation_type=str(record.get("escalation_type") or "").strip() or (None if pd.isna(record.get("current_escalation_type")) else record.get("current_escalation_type")),
            escalation_rate=Decimal(str(record.get("escalation_rate"))) if not pd.isna(record.get("escalation_rate")) else None,
            status=status,
            date_of_death=None if pd.isna(record.get("date_of_death")) else record.get("date_of_death"),
            commencement_date=None if pd.isna(record.get("commencement_date")) else record.get("commencement_date"),
            effective_from=None if pd.isna(record.get("effective_from")) else record.get("effective_from"),
            verification_reference=str(record.get("verification_reference") or "").strip() or None,
        )

    def _serialize_population_row_for_pipeline(
        self,
        contract_id: str,
        row: PopulationCsvNormalizedRow | None,
    ) -> dict[str, Any]:
        if row is None:
            return {"contract_id": contract_id}
        return {
            "contract_id": contract_id,
            "member_id": row.member_id,
            "policy_id": row.policy_id,
            "date_of_birth": row.date_of_birth.isoformat(),
            "gender": row.gender,
            "smoker_status": row.smoker_status,
            "postcode": row.postcode,
            "annual_pension": float(row.annual_pension),
            "pension_currency": row.pension_currency,
            "escalation_type": row.escalation_type,
            "escalation_rate": float(row.escalation_rate) if row.escalation_rate is not None else None,
            "status": row.status,
            "date_of_death": row.date_of_death.isoformat() if row.date_of_death else None,
            "commencement_date": row.commencement_date.isoformat() if row.commencement_date else None,
            "effective_from": row.effective_from.isoformat() if row.effective_from else None,
            "verification_reference": row.verification_reference,
        }

    def _serialize_population_csv_issue(self, issue: PopulationCsvIssue) -> dict[str, Any]:
        return {
            "field_name": issue.field_name,
            "severity": issue.severity,
            "issue_type": issue.issue_type,
            "description": issue.description,
            "current_value": issue.current_value,
            "ai_suggestion": issue.ai_suggestion,
            "ai_confidence": issue.ai_confidence,
        }

    def _validation_status_from_issues(self, issues: list[dict[str, Any]]) -> str:
        if any(issue["severity"] == "critical" for issue in issues):
            return "critical"
        if any(issue["severity"] == "warning" for issue in issues):
            return "warning"
        if any(issue["severity"] == "info" for issue in issues):
            return "warning"
        return "valid"

    def _build_exception_templates(
        self,
        cession_file: CessionFile,
        file_type: str,
        template_records: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if file_type == "Fixed Leg":
            resolved_by_stage = cession_file.stage in {"processed", "approved"}
            resolution = "accepted" if resolved_by_stage else "pending"
            return [
                {
                    "row_number": 100,
                    "field_name": "fixed_leg_amount",
                    "severity": "critical",
                    "issue_type": "variance",
                    "description": "Variance vs contract calc > 1.5%",
                    "current_value": "8914200",
                    "ai_suggestion": "8782055",
                    "ai_confidence": 0.97,
                    "resolution": resolution,
                },
                {
                    "row_number": 237,
                    "field_name": "fee_amount",
                    "severity": "warning",
                    "issue_type": "schedule_deviation",
                    "description": "Quarterly fee outside schedule by 0.7%",
                    "current_value": "412300",
                    "ai_suggestion": "409400",
                    "ai_confidence": 0.90,
                    "resolution": resolution,
                },
                {
                    "row_number": 374,
                    "field_name": "value_date",
                    "severity": "info",
                    "issue_type": "calendar_adjustment",
                    "description": "Settlement date is non-business day",
                    "current_value": "2025-03-30",
                    "ai_suggestion": "2025-03-31",
                    "ai_confidence": 0.99,
                    "resolution": resolution,
                },
                {
                    "row_number": 511,
                    "field_name": "fixed_leg_amount",
                    "severity": "critical",
                    "issue_type": "variance",
                    "description": "Variance vs contract calc > 1.5%",
                    "current_value": "8914200",
                    "ai_suggestion": "8782055",
                    "ai_confidence": 0.97,
                    "resolution": resolution,
                },
                {
                    "row_number": 648,
                    "field_name": "fee_amount",
                    "severity": "warning",
                    "issue_type": "schedule_deviation",
                    "description": "Quarterly fee outside schedule by 0.7%",
                    "current_value": "412300",
                    "ai_suggestion": "409400",
                    "ai_confidence": 0.90,
                    "resolution": resolution,
                },
                {
                    "row_number": 785,
                    "field_name": "value_date",
                    "severity": "info",
                    "issue_type": "calendar_adjustment",
                    "description": "Settlement date is non-business day",
                    "current_value": "2025-03-30",
                    "ai_suggestion": "2025-03-31",
                    "ai_confidence": 0.99,
                    "resolution": resolution,
                },
            ]

        if file_type == "Settlement":
            exceptions: list[dict[str, Any]] = []
            for record in template_records:
                for issue in record.get("exception_issues", record.get("validation_issues", [])):
                    exceptions.append(
                        {
                            "row_number": record["row_number"],
                            "field_name": issue["field_name"],
                            "severity": issue["severity"],
                            "issue_type": issue["issue_type"],
                            "description": issue["description"],
                            "current_value": issue.get("current_value"),
                            "ai_suggestion": issue.get("ai_suggestion"),
                            "ai_confidence": issue.get("ai_confidence"),
                            "resolution": "pending",
                        }
                    )
            exceptions.extend(self._build_settlement_header_mapping_exceptions(cession_file))
            return exceptions

        if file_type == "Pension Status":
            exceptions: list[dict[str, Any]] = []
            for record in template_records:
                for issue in record.get("validation_issues", []):
                    exceptions.append(
                        {
                            "row_number": record["row_number"],
                            "field_name": issue["field_name"],
                            "severity": issue["severity"],
                            "issue_type": issue["issue_type"],
                            "description": issue["description"],
                            "current_value": issue.get("current_value"),
                            "ai_suggestion": issue.get("ai_suggestion"),
                            "ai_confidence": issue.get("ai_confidence"),
                            "resolution": "pending",
                        }
                    )
            exceptions.extend(self._build_missing_active_member_exceptions(cession_file, template_records))
            return exceptions

        if file_type == "Mortality Report":
            return [
                {
                    "row_number": 245,
                    "field_name": "verified_by",
                    "severity": "warning",
                    "issue_type": "missing_verifier",
                    "description": "Verifier is blank for a mortality event",
                    "current_value": "",
                    "ai_suggestion": "Helvetia Ops Review",
                    "ai_confidence": 0.76,
                    "resolution": "pending" if cession_file.stage == "exceptions" else "accepted",
                }
            ]

        return [
            {
                "row_number": 240,
                "field_name": "activity_code",
                "severity": "critical",
                "issue_type": "unsupported_transition",
                "description": "Activity code could not be mapped to the current contract rule set",
                "current_value": "SPOUSE_CHANGE",
                "ai_suggestion": "Manual routing to claims ops",
                "ai_confidence": 0.88,
                "resolution": "pending",
            }
        ]

    def _build_settlement_header_mapping_exceptions(self, cession_file: CessionFile) -> list[dict[str, Any]]:
        source_content = self._get_override(cession_file.file_id).get("source_content_text", "")
        original_headers = self._original_upload_headers(source_content)
        if not original_headers:
            return []

        expected_header_fields = ("calculation_period", "fixed_leg", "floating_leg")
        exceptions: list[dict[str, Any]] = []
        for original_header in original_headers:
            normalized_header = self._normalize_column_name(str(original_header))
            matched_field = next(
                (
                    field_name
                    for field_name in expected_header_fields
                    if normalized_header in {self._normalize_column_name(alias) for alias in COLUMN_ALIASES_BY_FIELD.get(field_name, (field_name,))}
                ),
                None,
            )
            if not matched_field:
                continue
            target_header = SETTLEMENT_TARGET_HEADER_LABELS[matched_field]
            if normalized_header == self._normalize_column_name(target_header):
                continue
            exceptions.append(
                {
                    "row_number": 0,
                    "field_name": matched_field,
                    "severity": "warning",
                    "issue_type": "header_mapping_normalization",
                    "description": f'Settlement header "{original_header}" should map to "{target_header}".',
                    "current_value": str(original_header),
                    "ai_suggestion": target_header,
                    "ai_confidence": 1.0,
                    "resolution": "pending",
                }
            )
        return exceptions

    def _build_missing_active_member_exceptions(
        self,
        cession_file: CessionFile,
        template_records: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if not cession_file.contract_id:
            return []
        uploaded_member_ids = {
            str(record.get("member_id") or "").strip()
            for record in template_records
            if str(record.get("member_id") or "").strip()
        }
        current_active_members = [
            row
            for row in self.repository.list_current_population_for_contract(cession_file.contract_id)
            if (row.status or "").lower() == "active"
        ]
        missing_members = [row for row in current_active_members if row.member_id not in uploaded_member_ids]
        start_row = max([int(record["row_number"]) for record in template_records] or [0]) + 1
        return [
            {
                "row_number": start_row + index,
                "field_name": "member_id",
                "severity": "critical",
                "issue_type": "missing_active_member",
                "description": "Current active member is missing from the Pension Status upload.",
                "current_value": "",
                "ai_suggestion": f"Add member {row.member_id} with status {row.status}.",
                "ai_confidence": 0.91,
                "resolution": "pending",
            }
            for index, row in enumerate(missing_members)
        ]

    def _apply_exception_counts_to_file(self, cession_file: CessionFile) -> None:
        unresolved = self._count_unresolved_by_severity(cession_file)
        cession_file.critical_count = unresolved["critical"]
        cession_file.warning_count = unresolved["warning"]
        cession_file.error_count = unresolved["critical"]

    def _count_unresolved_by_severity(self, cession_file: CessionFile) -> dict[str, int]:
        counts = {"critical": 0, "warning": 0, "info": 0}
        for item in self.repository.list_file_exceptions(cession_file.id):
            if item.resolution not in {"accepted", "overridden"}:
                counts[item.severity] = counts.get(item.severity, 0) + 1
        return counts

    def _serialize_issue(self, item: CessionFileException) -> dict[str, Any]:
        clause_reference = {
            "fixed_leg_amount": "Â§6.2 ACT/365",
            "fee_amount": "Â§6.4 Fee Schedule",
            "value_date": "Â§3.4 Payment Date Convention",
            "date_of_death": "Â§7.3 Material Change Reporting",
            "verified_by": "Â§7.3 Material Change Reporting",
            "activity_code": "Â§7.3 Material Change Reporting",
        }.get(item.field_name, "Operational rule")
        clause_reference = {
            "fixed_leg_amount": "SQL-CONTRACT-FIXED-LEG",
            "fixed_leg": "SQL-SETTLEMENT-FIXED-FLOATING",
            "floating_leg": "SQL-SETTLEMENT-FIXED-FLOATING",
            "net_settlement_amount": "SQL-SETTLEMENT-NET",
            "calculation_period": "SQL-SETTLEMENT-NET",
            "payment_date": "SQL-SETTLEMENT-NET",
            "fee": "SQL-SETTLEMENT-NET",
            "interest_prior_period": "SQL-SETTLEMENT-NET",
            "fee_amount": "SQL-CONTRACT-FIXED-LEG",
            "value_date": "SQL-CONTRACT-CURRENCY",
            "member_id": "SQL-POLICY-REGISTER-SCOPE",
            "status": "SQL-POLICY-REGISTER-SCD2",
            "effective_from": "SQL-POLICY-REGISTER-SCD2",
            "date_of_death": "SQL-POLICY-DEATH-DATE",
            "verified_by": "SQL-MOVEMENT-REPORTING",
            "activity_code": "SQL-MOVEMENT-REPORTING",
        }.get(item.field_name, clause_reference)
        return {
            "severity": item.severity,
            "row": item.row_number,
            "field": item.field_name,
            "issue": item.description,
            "current_value": item.current_value,
            "ai_suggestion": item.ai_suggestion,
            "ai_confidence": round(self._to_float(item.ai_confidence), 2),
            "clause_reference": clause_reference,
        }

    def _ensure_processing_worklist_items(self, cession_file: CessionFile) -> list[WorklistItem]:
        existing = self.repository.list_worklist_items_for_file(cession_file.id)
        if existing:
            return existing

        summary = self._build_summary_payload(cession_file)
        detection = self._build_detection_payload(cession_file)
        mapping = self._build_contract_mapping_payload(cession_file)
        now = datetime.now(UTC)
        settlement_impact = summary.get("settlement_impact") or {}
        settlement_id = settlement_impact.get("settlement_id_created")
        if detection["file_type"] == "Settlement":
            reconciliation = summary.get("settlement_reconciliation") or {}
            if reconciliation.get("decision") == "accept":
                title = f"Settlement approval pending - {settlement_id or cession_file.file_id}"
                category = "Settlement Approval"
                breadcrumb = "Settlement Approval - Reconciled File"
            else:
                mismatch_count = len(reconciliation.get("mismatches") or [])
                title = f"Settlement reconciliation review - {settlement_id or cession_file.file_id}"
                category = "Reconciliation Mismatch"
                breadcrumb = f"Settlement Reconciliation - {mismatch_count} mismatch(es)"
        else:
            title = (
                "Resolve 2 critical validation errors"
                if detection["file_type"] == "Fixed Leg"
                else f"{detection['file_type']} review â€” {cession_file.file_id}"
            )
            category = "Validation"
            breadcrumb = "Cession File Â· Validation Review"

        item = WorklistItem(
            wl_id=self.repository.get_next_worklist_id(),
            title=title,
            description=summary["insight"],
            category=category,
            priority="high",
            status="open",
            assigned_role="claims_ops",
            contract_id=mapping["contract_id"],
            cedent_id=detection["cedent_id"],
            cession_file_id=cession_file.id,
            settlement_id=settlement_id,
            source="AI Agent",
            source_detail="Cession pipeline processing",
            sla_deadline=now + timedelta(hours=2),
            ai_generated=True,
            breadcrumb=breadcrumb,
            created_at=now,
            updated_at=now,
        )
        created = self.repository.create_worklist_item(item)
        return [created]

    def _build_stage_history(self, cession_file: CessionFile) -> list[dict[str, Any]]:
        stored = self._get_override(cession_file.file_id)
        explicit = stored.get("stage_history")
        if explicit:
            return explicit

        base_time = cession_file.received_at or datetime.now(UTC)
        chain = self._default_stage_chain(cession_file.stage, cession_file.critical_count or 0)
        return [
            {
                "stage": stage_name,
                "completed_at": self._to_iso(base_time + timedelta(minutes=index)),
            }
            for index, stage_name in enumerate(chain)
        ]

    def _build_stage_log(self, cession_file: CessionFile) -> list[dict[str, Any]]:
        stored = self._get_override(cession_file.file_id)
        explicit = stored.get("stage_log")
        if explicit:
            return explicit

        active_step = self._resolve_active_step(cession_file)
        active_index = PIPELINE_STEPS.index(active_step)
        base_time = cession_file.received_at or datetime.now(UTC)
        stage_log = []
        for index, step in enumerate(PIPELINE_STEPS):
            if index < active_index:
                status = "complete"
            elif index == active_index and cession_file.stage != "approved":
                status = "in_progress"
            else:
                status = "pending"
            if cession_file.stage == "approved":
                status = "complete"
            stage_log.append(
                {
                    "stage": step.replace("-", "_"),
                    "status": status,
                    "timestamp": self._to_iso(base_time + timedelta(minutes=index)),
                }
            )
        return stage_log

    def _resolve_active_step(self, cession_file: CessionFile) -> str:
        stored = self._get_override(cession_file.file_id)
        active_step = stored.get("active_step")
        if active_step in PIPELINE_STEPS:
            return active_step

        return {
            "uploaded": "upload",
            "detected": "detect",
            "mapped": "map-contract",
            "clauses": "clauses",
            "validated": "exceptions" if (cession_file.critical_count or 0) > 0 else "process",
            "exceptions": "exceptions",
            "processing": "process",
            "processed": "summary",
            "approved": "audit",
        }.get(cession_file.stage, "upload")

    def _default_stage_chain(self, db_stage: str, critical_count: int) -> list[str]:
        if db_stage == "uploaded":
            return ["uploaded"]
        if db_stage == "detected":
            return ["uploaded", "detecting", "detected"]
        if db_stage == "mapped":
            return ["uploaded", "detecting", "detected", "mapped"]
        if db_stage == "clauses":
            return ["uploaded", "detecting", "detected", "mapped", "clauses"]
        if db_stage in {"validated", "exceptions"}:
            chain = ["uploaded", "detecting", "detected", "mapped", "clauses", "validated"]
            if db_stage == "exceptions" or critical_count:
                chain.append("exceptions")
            return chain
        if db_stage == "processing":
            return ["uploaded", "detecting", "detected", "mapped", "clauses", "validated", "exceptions", "processing"]
        if db_stage == "processed":
            return [
                "uploaded",
                "detecting",
                "detected",
                "mapped",
                "clauses",
                "validated",
                "exceptions",
                "processing",
                "processed",
            ]
        if db_stage == "approved":
            return [
                "uploaded",
                "detecting",
                "detected",
                "mapped",
                "clauses",
                "validated",
                "exceptions",
                "processing",
                "processed",
                "approved",
            ]
        return ["uploaded"]

    def _step_completion_pct(self, current_step: str, db_stage: str) -> int:
        if db_stage == "approved":
            return 100
        index = PIPELINE_STEPS.index(current_step)
        return round((index / (len(PIPELINE_STEPS) - 1)) * 100)

    def _detect_file_profile(
        self,
        filename: str,
        content: str,
        provided_cedent: Any | None = None,
        provided_contract: Contract | None = None,
        *,
        allow_ai: bool = False,
    ) -> dict[str, Any]:
        logger.info("Deriving cession file profile from filename and DB context")
        logger.debug("Cession profile derive filename=%s provided_cedent=%s provided_contract=%s", filename, provided_cedent, provided_contract)
        filename_tokens = self._filename_tokens(filename)
        content_columns = self._content_columns(content)
        member_ids = self._extract_member_ids_from_content(content)

        inferred_contract = provided_contract
        inferred_cedent = provided_cedent
        member_overlap_count = 0
        filename_cedent = self._match_cedent_from_filename(filename_tokens)
        filename_contract = self._match_contract_from_filename(filename_tokens, filename_cedent)
        overlap_contract = None
        if member_ids:
            overlap = self.repository.find_contract_by_member_overlap(member_ids)
            if overlap:
                overlap_contract = self.repository.get_contract(overlap[0])
                member_overlap_count = overlap[1]

        conflict_detected = False
        if inferred_contract is not None and inferred_cedent is None:
            inferred_cedent = self.repository.get_cedent(inferred_contract.cedent_id)
        elif inferred_cedent is not None and inferred_contract is None:
            inferred_contract = self._match_contract_from_filename(filename_tokens, inferred_cedent)
        elif inferred_cedent is None and inferred_contract is None:
            if filename_cedent is not None:
                inferred_cedent = filename_cedent
                inferred_contract = filename_contract or self._first_contract_for_cedent(filename_cedent.cedent_id)
                if overlap_contract is not None and overlap_contract.cedent_id != filename_cedent.cedent_id:
                    conflict_detected = True
            elif overlap_contract is not None:
                inferred_contract = overlap_contract
                inferred_cedent = self.repository.get_cedent(overlap_contract.cedent_id)

        if inferred_contract is None and inferred_cedent is not None:
            inferred_contract = self._first_contract_for_cedent(inferred_cedent.cedent_id)

        file_type, file_type_confidence, file_type_basis = self._detect_file_type_from_filename_and_columns(
            filename_tokens,
            content_columns,
        )
        period = self._period_from_content(content) or self._period_from_filename(filename)
        record_count = self._count_records(filename, content)
        cedent_confidence = 1.0 if provided_cedent else self._confidence_from_match(inferred_cedent is not None, filename_tokens)
        if conflict_detected:
            cedent_confidence = min(cedent_confidence, 0.74)
        contract_confidence = 1.0 if provided_contract else (
            min(0.98, 0.70 + (member_overlap_count / max(len(member_ids), 1)) * 0.25)
            if member_overlap_count
            else self._confidence_from_match(inferred_contract is not None, filename_tokens)
        )
        if conflict_detected:
            contract_confidence = min(contract_confidence, 0.72)

        reasoning_parts = [file_type_basis]
        if inferred_cedent:
            reasoning_parts.append(f'cedant matched to "{inferred_cedent.legal_entity_name}" from filename/contract context')
        if inferred_contract:
            reasoning_parts.append(f"contract matched to {inferred_contract.contract_id}")
        if member_overlap_count:
            reasoning_parts.append(f"{member_overlap_count} uploaded member id(s) matched current policy_register rows")
        if conflict_detected and overlap_contract:
            reasoning_parts.append(
                f"filename cedant conflicted with member-overlap contract {overlap_contract.contract_id}; filename cedant took precedence"
            )

        profile = {
            "file_type": file_type,
            "cedent_id": inferred_contract.cedent_id if inferred_contract else (inferred_cedent.cedent_id if inferred_cedent else None),
            "cedent_name": inferred_cedent.legal_entity_name if inferred_cedent else "Unmapped cedent",
            "contract_id": inferred_contract.contract_id if inferred_contract else None,
            "period": period,
            "file_type_confidence": file_type_confidence,
            "cedent_confidence": cedent_confidence,
            "contract_confidence": contract_confidence,
            "record_count": record_count,
            "iris_reasoning": "; ".join(reasoning_parts) + ".",
        }

        if allow_ai and self._should_use_ai_detection(profile, conflict_detected):
            ai_profile = self._ai_detect_file_profile(filename, content, profile)
            if ai_profile:
                profile.update(ai_profile)
                profile["iris_reasoning"] = f'{profile["iris_reasoning"]} AI fallback reviewed low-confidence detection.'
                logger.info("Applied AI fallback detection for cession file profile")
                logger.debug("AI fallback profile filename=%s profile=%s", filename, profile)

        return profile

    def _normalize_file_type(self, value: str | None) -> str | None:
        if not value:
            return None
        normalized = value.strip().lower().replace("_", " ").replace("-", " ")
        for option in FILE_TYPE_OPTIONS:
            if normalized == option.lower():
                return option
        return None

    def _filename_tokens(self, filename: str) -> set[str]:
        stem = Path(filename).stem.lower()
        return {token for token in re.split(r"[^a-z0-9]+", stem) if token}

    def _content_columns(self, content: str) -> set[str]:
        if not content.strip():
            return set()
        try:
            reader = csv.reader(io.StringIO(content.lstrip("\ufeff")), delimiter=self._detect_tabular_delimiter(content))
            headers = next(reader, [])
        except csv.Error:
            return set()
        return {self._normalize_column_name(str(header)) for header in headers if str(header).strip()}

    def _normalize_column_name(self, value: str) -> str:
        normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower())
        return normalized.strip("_")

    def _detect_tabular_delimiter(self, content: str) -> str:
        cleaned_content = content.lstrip("\ufeff")
        first_line = next((line for line in cleaned_content.splitlines() if line.strip()), "")
        if not first_line:
            return ","
        try:
            dialect = csv.Sniffer().sniff(cleaned_content[:4096], delimiters=",\t;|")
            return dialect.delimiter
        except csv.Error:
            delimiter_counts = {delimiter: first_line.count(delimiter) for delimiter in (",", "\t", ";", "|")}
            best_delimiter, best_count = max(delimiter_counts.items(), key=lambda item: item[1])
            return best_delimiter if best_count > 0 else ","

    def _extract_member_ids_from_content(self, content: str) -> list[str]:
        if not content.strip():
            return []
        try:
            frame = pd.read_csv(io.StringIO(content), dtype=str).fillna("")
        except Exception:
            return []
        frame.columns = [self._normalize_column_name(str(column)) for column in frame.columns]
        member_column = next((column for column in ("member_id", "pensioner_ref") if column in frame.columns), None)
        if member_column is None:
            return []
        return [value for value in frame[member_column].astype(str).str.strip().tolist() if value]

    def _detect_file_type_from_filename_and_columns(
        self,
        filename_tokens: set[str],
        content_columns: set[str],
    ) -> tuple[str, float, str]:
        if self._content_has_required_fields(content_columns, REQUIRED_FIELDS_BY_FILE_TYPE["Settlement"]):
            logger.info("Detected Settlement file from required settlement header signature")
            logger.debug("Settlement header detection columns=%s", sorted(content_columns))
            return "Settlement", 0.98, "file type derived from complete settlement header signature"
        if {"fixed", "leg"} <= filename_tokens or "fixed_leg_amount" in content_columns:
            return "Fixed Leg", 0.94, "file type derived from fixed-leg filename tokens/header signature"
        if {"mortality"} & filename_tokens or "death_date" in content_columns or "cause_code" in content_columns:
            return "Mortality Report", 0.92, "file type derived from mortality filename tokens/header signature"
        if {"spouse", "beneficiary"} & filename_tokens or "spouse_dob" in content_columns or "benefit_pct" in content_columns:
            return "Spouse Events", 0.90, "file type derived from spouse/beneficiary filename tokens/header signature"
        if {"activity", "movement"} & filename_tokens or "activity_code" in content_columns:
            return "Activity Report", 0.88, "file type derived from activity filename tokens/header signature"
        if {"fee", "fees"} & filename_tokens or "fee_amount" in content_columns:
            return "Fee Schedule", 0.86, "file type derived from fee filename tokens/header signature"
        if {"status", "pensioner", "pensioners"} & filename_tokens or (
            "member_id" in content_columns and "status" in content_columns
        ):
            return "Pension Status", 0.96, "file type derived from pension-status filename tokens/header signature"
        return "Unclassified", 0.35, "file type could not be confidently derived from filename or headers"

    def _content_has_required_fields(self, content_columns: set[str], field_names: list[str]) -> bool:
        for field_name in field_names:
            aliases = COLUMN_ALIASES_BY_FIELD.get(field_name, (field_name,))
            normalized_aliases = {self._normalize_column_name(alias) for alias in aliases}
            if not content_columns & normalized_aliases:
                return False
        return True

    def _match_cedent_from_filename(self, filename_tokens: set[str]) -> Any | None:
        stopwords = {"pension", "pensions", "trust", "fund", "plan", "retirement", "corporate", "industrial", "the"}
        best_match = None
        best_score = 0
        for cedent in self.repository.list_all_cedents():
            candidate_tokens = self._filename_tokens(cedent.legal_entity_name)
            if cedent.trading_name:
                candidate_tokens |= self._filename_tokens(cedent.trading_name)
            candidate_tokens.add(cedent.cedent_id.lower())
            scored_tokens = {token for token in candidate_tokens if token not in stopwords}
            score = len(filename_tokens & scored_tokens)
            if score > best_score:
                best_match = cedent
                best_score = score
        return best_match if best_score > 0 else None

    def _match_contract_from_filename(self, filename_tokens: set[str], cedent: Any | None) -> Contract | None:
        best_match = None
        best_score = 0
        for contract in self.repository.list_all_contracts():
            candidate_tokens = self._filename_tokens(contract.contract_id) | self._filename_tokens(contract.contract_name)
            score = len(filename_tokens & candidate_tokens)
            if cedent and contract.cedent_id == cedent.cedent_id:
                score += 2
            if score > best_score:
                best_match = contract
                best_score = score
        return best_match if best_score > 0 else None

    def _first_contract_for_cedent(self, cedent_id: str | None) -> Contract | None:
        if not cedent_id:
            return None
        contracts = [item for item in self.repository.list_all_contracts() if item.cedent_id == cedent_id]
        active_contract = next((item for item in contracts if (item.status or "").lower() == "active"), None)
        return active_contract or (contracts[0] if contracts else None)

    def _should_use_ai_detection(self, profile: dict[str, Any], conflict_detected: bool) -> bool:
        if openai_client is None:
            return False
        if conflict_detected:
            return True
        confidence_values = [
            self._to_float(profile.get("file_type_confidence")),
            self._to_float(profile.get("cedent_confidence")),
            self._to_float(profile.get("contract_confidence")),
        ]
        return any(value < DETECTION_AI_CONFIDENCE_THRESHOLD for value in confidence_values)

    def _ai_detect_file_profile(self, filename: str, content: str, deterministic_profile: dict[str, Any]) -> dict[str, Any] | None:
        logger.info("Running AI fallback for cession file detection")
        logger.debug("AI detection fallback filename=%s deterministic_profile=%s", filename, deterministic_profile)
        cedents = [
            {"cedent_id": item.cedent_id, "legal_entity_name": item.legal_entity_name, "trading_name": item.trading_name}
            for item in self.repository.list_all_cedents()
        ]
        contracts = [
            {
                "contract_id": item.contract_id,
                "contract_name": item.contract_name,
                "cedent_id": item.cedent_id,
                "contract_version": item.contract_version,
                "status": item.status,
            }
            for item in self.repository.list_all_contracts()
        ]
        sample_rows = "\n".join(content.splitlines()[:8])
        try:
            response = openai_client.responses.create(
                model=OPENAI_MODEL,
                instructions=(
                    "You classify cession file uploads for IRiS. Use only the supplied cedents and contracts. "
                    "Return JSON only with keys file_type, cedent_id, contract_id, period, confidence, reasoning. "
                    "Allowed file_type values: Pension Status, Settlement, Fixed Leg, Mortality Report, Spouse Events, Activity Report, Fee Schedule, Unclassified. "
                    "If filename tokens clearly name a cedent, prioritize that over weak member-overlap evidence."
                ),
                input=json.dumps(
                    {
                        "filename": filename,
                        "columns": sorted(self._content_columns(content)),
                        "sample_rows": sample_rows,
                        "deterministic_profile": deterministic_profile,
                        "cedents": cedents,
                        "contracts": contracts,
                    }
                ),
            )
            raw_text = getattr(response, "output_text", "") or ""
            parsed = self._extract_json_object(raw_text)
        except Exception as exc:
            logger.error("AI cession detection fallback failed filename=%s error=%s", filename, exc)
            return None

        file_type = self._normalize_file_type(parsed.get("file_type")) or deterministic_profile["file_type"]
        cedent_id = str(parsed.get("cedent_id") or deterministic_profile.get("cedent_id") or "")
        contract_id = str(parsed.get("contract_id") or deterministic_profile.get("contract_id") or "")
        confidence = min(max(float(parsed.get("confidence") or 0.78), 0.0), 1.0)
        cedent = self.repository.get_cedent(cedent_id)
        contract = self.repository.get_contract(contract_id)
        if cedent is None:
            cedent_id = deterministic_profile.get("cedent_id")
            cedent = self.repository.get_cedent(cedent_id)
        if contract is None or (cedent_id and contract.cedent_id != cedent_id):
            contract = self._first_contract_for_cedent(cedent_id) or self.repository.get_contract(deterministic_profile.get("contract_id"))

        return {
            "file_type": file_type,
            "cedent_id": cedent_id,
            "cedent_name": cedent.legal_entity_name if cedent else deterministic_profile.get("cedent_name", "Unmapped cedent"),
            "contract_id": contract.contract_id if contract else deterministic_profile.get("contract_id"),
            "period": str(parsed.get("period") or deterministic_profile["period"]),
            "file_type_confidence": max(confidence, deterministic_profile["file_type_confidence"]),
            "cedent_confidence": confidence,
            "contract_confidence": confidence,
            "iris_reasoning": str(parsed.get("reasoning") or deterministic_profile["iris_reasoning"]),
        }

    def _extract_json_object(self, raw_text: str) -> dict[str, Any]:
        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if not match:
            return {}
        try:
            payload = json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
        return payload if isinstance(payload, dict) else {}

    def _confidence_from_match(self, matched: bool, filename_tokens: set[str]) -> float:
        if not matched:
            return 0.22
        return 0.92 if len(filename_tokens) >= 3 else 0.78

    def _period_from_content(self, content: str) -> str | None:
        for row in self._parse_upload_dict_rows(content):
            for field_name in ("calculation_period", "period"):
                period = self._normalize_period_label(self._aliased_raw_value(row, field_name))
                if period:
                    return period
        return None

    def _period_from_filename(self, filename: str) -> str:
        stem = Path(filename).stem.lower()
        compact_match = re.search(r"(20\d{2})\s*[-_ ]?\s*q([1-4])", stem)
        if compact_match:
            return f"Q{compact_match.group(2)} {compact_match.group(1)}"
        reversed_match = re.search(r"q([1-4])\s*[-_ ]?\s*(20\d{2})", stem)
        if reversed_match:
            return f"Q{reversed_match.group(1)} {reversed_match.group(2)}"
        year_match = re.search(r"(20\d{2})", stem)
        if year_match:
            return f"Q1 {year_match.group(1)}"
        return "Unspecified period"

    def _normalize_period_label(self, value: Any) -> str | None:
        text = str(value or "").strip()
        if not text:
            return None
        compact_match = re.search(r"\b(20\d{2})\D*q([1-4])\b", text, re.IGNORECASE)
        if compact_match:
            return f"Q{compact_match.group(2)} {compact_match.group(1)}"
        reversed_match = re.search(r"\bq([1-4])\D*(20\d{2})\b", text, re.IGNORECASE)
        if reversed_match:
            return f"Q{reversed_match.group(1)} {reversed_match.group(2)}"
        parsed_date = self._parse_flexible_date(text)
        if parsed_date:
            return self._quarter_label(parsed_date)
        return None

    def _mock_settlement_for_contract(self, contract_id: str) -> dict[str, Any]:
        settlements = load_mock_data("settlements_seed.json")
        settlement = next((item for item in settlements if item["contract_id"] == contract_id), None)
        if settlement:
            return settlement
        return {
            "settlement_id": f"SET-{contract_id[-4:]}-Q1",
            "currency": "USD",
            "net_amount": 0,
        }

    def _period_bounds(self, period_label: str) -> tuple[date, date]:
        normalized_period = self._normalize_period_label(period_label) or period_label
        match = re.search(r"Q([1-4])\s+(20\d{2})", normalized_period, re.IGNORECASE)
        if match:
            return self._quarter_bounds(int(match.group(2)), int(match.group(1)))
        match = re.search(r"(20\d{2})\s+Q([1-4])", normalized_period, re.IGNORECASE)
        if not match:
            today = date.today()
            quarter = ((today.month - 1) // 3) + 1
            return self._quarter_bounds(today.year, quarter)
        return self._quarter_bounds(int(match.group(1)), int(match.group(2)))

    def _quarter_bounds(self, year: int, quarter: int) -> tuple[date, date]:
        start_month = ((quarter - 1) * 3) + 1
        start = date(year, start_month, 1)
        if quarter == 4:
            end = date(year, 12, 31)
        else:
            end = date(year, start_month + 3, 1) - timedelta(days=1)
        return start, end

    def _settlement_id_for(self, contract_id: str, period_label: str) -> str:
        normalized_period = self._normalize_period_label(period_label) or period_label
        match = re.search(r"Q([1-4])\s+(20\d{2})", normalized_period, re.IGNORECASE)
        if match:
            return f"SET-{match.group(2)}-Q{match.group(1)}-{contract_id.split('-')[-1]}"
        match = re.search(r"(20\d{2})\s+Q([1-4])", normalized_period, re.IGNORECASE)
        if not match:
            return f"SET-{contract_id[-3:]}-{date.today().strftime('%Y%m%d')}"
        return f"SET-{match.group(1)}-Q{match.group(2)}-{contract_id.split('-')[-1]}"

    def _fixed_leg_from_contract(self, contract: Contract, period_start: date, period_end: date) -> float:
        notional = self._to_float(contract.notional_amount)
        rate = self._to_float(contract.fixed_leg_rate)
        days = max((period_end - period_start).days + 1, 1)
        if (contract.fixed_leg_frequency or "").lower() == "quarterly":
            return round(notional * rate * (days / 365), 2)
        return round(notional * rate, 2)

    def _floating_leg_from_population(self, contract_id: str) -> float:
        current_rows = self.repository.list_current_population_for_contract(contract_id)
        eligible_rows = [row for row in current_rows if (row.status or "").lower() in {"active", "deferred"}]
        return round(sum(self._to_float(row.annual_pension) for row in eligible_rows) / 4, 2)

    def _serialize_settlement_model(self, settlement: Settlement) -> dict[str, Any]:
        contract = self.repository.get_contract(settlement.contract_id)
        cedent = self.repository.get_cedent(settlement.cedent_id) or (
            self.repository.get_cedent(contract.cedent_id) if contract and contract.cedent_id else None
        )
        return {
            "settlement_id": settlement.settlement_id,
            "settlement_display_id": settlement.settlement_id.replace("SET-", "STL-", 1),
            "contract_id": settlement.contract_id,
            "contract_display_id": settlement.contract_id,
            "contract_name": contract.contract_name if contract else "Unmapped contract",
            "contract_version": contract.contract_version if contract else "v1.0",
            "cedent_id": settlement.cedent_id,
            "cedent_name": cedent.legal_entity_name if cedent else "Unmapped cedent",
            "period_label": settlement.period_label,
            "period_start": settlement.period_start.isoformat(),
            "period_end": settlement.period_end.isoformat(),
            "fixed_leg_amount": round(self._to_float(settlement.fixed_leg_amount), 2),
            "floating_leg_amount": round(self._to_float(settlement.floating_leg_amount), 2),
            "net_amount": round(self._to_float(settlement.net_amount), 2),
            "currency": settlement.currency or (contract.currency if contract else "USD"),
            "direction": settlement.direction,
            "payment_due_date": settlement.payment_due_date.isoformat() if settlement.payment_due_date else None,
            "status": settlement.status,
            "iris_recommendation": "accept",
            "source": settlement.notes or "Claims cession pipeline",
            "last_updated": self._to_iso(settlement.updated_at),
        }

    def _load_settlement_seed_rows(self) -> list[dict[str, Any]]:
        return deepcopy(load_mock_data("settlements_seed.json"))

    def _load_settlements(self) -> list[dict[str, Any]]:
        settlement_rows = self._load_settlement_seed_rows()
        overrides = self._read_settlement_override_store()
        hydrated_rows: list[dict[str, Any]] = []
        db_rows_by_id = {
            item.settlement_id: self._serialize_settlement_model(item)
            for item in self.repository.list_settlements()
        }
        for item in settlement_rows:
            if item["settlement_id"] in db_rows_by_id:
                hydrated_rows.append(self._hydrate_settlement_row(db_rows_by_id.pop(item["settlement_id"]), overrides))
            else:
                hydrated_rows.append(self._hydrate_settlement_row(item, overrides))
        created_rows = overrides.get(CREATED_SETTLEMENTS_KEY, {})
        if isinstance(created_rows, dict):
            for item in created_rows.values():
                if isinstance(item, dict):
                    if item.get("settlement_id") in db_rows_by_id:
                        continue
                    hydrated_rows.append(self._hydrate_settlement_row(item, overrides))
        for item in db_rows_by_id.values():
            hydrated_rows.append(self._hydrate_settlement_row(item, overrides))
        return hydrated_rows

    def _matches_settlement_filters(
        self,
        settlement: dict[str, Any],
        status: str,
        contract_id: str | None,
        cedent_id: str | None,
        period: str | None,
    ) -> bool:
        if status and status != "all" and settlement.get("status") != status:
            return False
        if contract_id and settlement.get("contract_id") != contract_id:
            return False
        if cedent_id and settlement.get("cedent_id") != cedent_id:
            return False
        if period and settlement.get("period_label") != period:
            return False
        return True

    def _build_settlement_metrics(self, settlements: list[dict[str, Any]]) -> dict[str, Any]:
        pending_statuses = {
            "variance_review",
            "ready_for_payment",
            "pending_reconciliation",
            "compliance_hold",
            "pending_approval",
            "held",
            "disputed",
        }
        return {
            "pending_approval": sum(1 for item in settlements if item.get("status") == "pending_approval"),
            "pending_amount": round(
                sum(self._to_float(item.get("floating_leg_amount")) for item in settlements if item.get("status") in pending_statuses)
            ),
            "paid_ytd": sum(1 for item in settlements if item.get("status") in {"approved", "paid"}),
            "dispute_count": sum(1 for item in settlements if item.get("status") == "disputed"),
        }

    def _serialize_settlement_list_item(self, settlement: dict[str, Any]) -> dict[str, Any]:
        contract = self.repository.get_contract(settlement.get("contract_id"))
        cedent = self.repository.get_cedent(settlement.get("cedent_id")) or (
            self.repository.get_cedent(contract.cedent_id) if contract and contract.cedent_id else None
        )
        cedent_name = settlement.get("cedent_name") or (cedent.legal_entity_name if cedent else "Unmapped cedent")
        return {
            "settlement_id": settlement["settlement_id"],
            "settlement_display_id": settlement.get("settlement_display_id"),
            "contract_id": settlement.get("contract_id"),
            "contract_display_id": settlement.get("contract_display_id") or settlement.get("contract_id"),
            "contract_name": settlement.get("contract_name") or (contract.contract_name if contract else "Unmapped contract"),
            "contract_version": settlement.get("contract_version") or (contract.contract_version if contract else "v1.0"),
            "cedent_id": settlement.get("cedent_id"),
            "cedent_name": cedent_name,
            "period_label": settlement.get("period_label"),
            "fixed_leg": round(self._to_float(settlement.get("fixed_leg_amount")), 2),
            "floating_leg": round(self._to_float(settlement.get("floating_leg_amount")), 2),
            "net_amount": round(self._to_float(settlement.get("net_amount")), 2),
            "currency": settlement.get("currency") or (contract.currency if contract else "USD"),
            "direction": settlement.get("direction"),
            "payment_due": settlement.get("payment_due_date"),
            "status": settlement.get("status", "pending_approval"),
            "iris_recommendation": settlement.get("iris_recommendation"),
        }

    def _get_settlement_or_error(self, settlement_id: str) -> dict[str, Any]:
        settlement = next((item for item in self._load_settlements() if item["settlement_id"] == settlement_id), None)
        if settlement is None:
            logger.error("Requested settlement was not found settlement_id=%s", settlement_id)
            raise IrisAPIError(404, "Invalid settlement ID", "Settlement not found in mock register")
        return settlement

    def _build_settlement_detail(self, settlement: dict[str, Any]) -> dict[str, Any]:
        contract = self.repository.get_contract(settlement.get("contract_id"))
        cedent = self.repository.get_cedent(settlement.get("cedent_id")) or (
            self.repository.get_cedent(contract.cedent_id) if contract and contract.cedent_id else None
        )
        cedent_name = settlement.get("cedent_name") or (cedent.legal_entity_name if cedent else "Unmapped cedent")
        return {
            "settlement_id": settlement["settlement_id"],
            "settlement_display_id": settlement.get("settlement_display_id"),
            "contract_id": settlement.get("contract_id"),
            "contract_display_id": settlement.get("contract_display_id") or settlement.get("contract_id"),
            "contract_name": settlement.get("contract_name") or (contract.contract_name if contract else "Unmapped contract"),
            "contract_version": settlement.get("contract_version") or (contract.contract_version if contract else "v1.0"),
            "cedent_id": settlement.get("cedent_id"),
            "cedent_name": cedent_name,
            "period_label": settlement.get("period_label"),
            "period_start": settlement.get("period_start"),
            "period_end": settlement.get("period_end"),
            "currency": settlement.get("currency") or (contract.currency if contract else "USD"),
            "direction": settlement.get("direction"),
            "payment_due": settlement.get("payment_due_date"),
            "status": settlement.get("status", "pending_approval"),
            "source": settlement.get("source", "Claims cession pipeline"),
            "last_updated": settlement.get("last_updated") or self._settlement_last_updated(settlement),
            "fixed_leg": round(self._to_float(settlement.get("fixed_leg_amount")), 2),
            "floating_leg": round(self._to_float(settlement.get("floating_leg_amount")), 2),
            "net_amount": round(self._to_float(settlement.get("net_amount")), 2),
            "variance_review": self._build_settlement_variance_review(settlement, cedent_name),
            "contributors": self._build_settlement_contributors(settlement),
            "approval_workflow": self._build_settlement_approval_workflow(settlement),
            "audit_trail": self._load_settlement_audit_trail(settlement) or settlement.get("audit_trail") or self._default_settlement_audit(settlement),
            "notes": settlement.get("notes"),
            "dispute_reason": settlement.get("dispute_reason"),
            "approved_at": settlement.get("approved_at"),
        }

    def _build_settlement_variance_review(self, settlement: dict[str, Any], cedent_name: str) -> dict[str, Any]:
        fixed_leg = max(self._to_float(settlement.get("fixed_leg_amount")), 1.0)
        net_amount = self._to_float(settlement.get("net_amount"))
        threshold = round(max(fixed_leg * 0.01, 50000), 2)
        variance_pct = round((net_amount / fixed_leg) * 100, 3)
        status = settlement.get("status")

        if status == "disputed":
            classification = "Variance Dispute"
            recommendation = "Escalate to underwriting"
        elif abs(net_amount) >= 150000:
            classification = "Late Mortality Reporting" if net_amount >= 0 else "Premium True-up"
            recommendation = "Recommend accept" if net_amount >= 0 else "Recommend review"
        elif abs(net_amount) >= 75000:
            classification = "Experience Drift"
            recommendation = "Recommend accept"
        else:
            classification = "Expected Quarter-end Close"
            recommendation = "Recommend accept"

        root_causes = {
            "LSC-2024-019": "Q4-2024 mortality updates arrived after period close, creating a one-quarter catch-up.",
            "LSC-2024-031": "Expected mortality emerged slightly above pricing assumptions, offset by stable annuity runoff.",
            "LSC-2025-002": "Fixed-leg accruals were restated after treaty lock-in, producing a cedant-to-reinsurer true-up.",
        }
        return {
            "confidence": 0.91 if abs(net_amount) >= 150000 else 0.87,
            "classification": classification,
            "threshold": threshold,
            "breach": abs(net_amount) >= threshold,
            "variance_pct": variance_pct,
            "root_cause": root_causes.get(
                settlement.get("contract_id"),
                f"{cedent_name} produced a routine quarter-end variance within the normal operating band.",
            ),
            "historical_comparison": (
                f"Variance has remained within +/-1.2% for {cedent_name} across the last six quarters."
                if abs(variance_pct) < 1.2
                else f"Variance is above the recent operating band for {cedent_name} and requires an approval note."
            ),
            "rationale": (
                "Variance is aligned with file timing and historical settlement drift."
                if abs(net_amount) < threshold
                else "Variance is above the control threshold and should be acknowledged before release."
            ),
            "recommendation": recommendation,
        }

    def _build_settlement_contributors(self, settlement: dict[str, Any]) -> list[dict[str, Any]]:
        net_amount = self._to_float(settlement.get("net_amount"))
        shares = [0.42, 0.27, 0.19, 0.12]
        member_rows = [
            ("PEN-0103221", "M. Whitcomb", "Late Notification", "2024-12-22"),
            ("PEN-0104012", "S. Markov", "Death", "2025-01-08"),
            ("PEN-0103998", "A. Richter", "New Spouse", "2025-02-19"),
            ("PEN-0103118", "C. Hollis", "Benefit Adjustment", "2025-03-01"),
        ]
        if net_amount < 0:
            member_rows = [
                ("PEN-0201102", "R. Berger", "Premium True-up", "2025-01-11"),
                ("PEN-0201844", "T. Muller", "Reserve Correction", "2025-02-02"),
                ("PEN-0201905", "L. Werner", "Data Restatement", "2025-02-21"),
                ("PEN-0202018", "J. Hoffman", "Interest Carry Forward", "2025-03-10"),
            ]
        return [
            {
                "member_id": member_id,
                "member_name": member_name,
                "event": event,
                "event_date": event_date,
                "impact": round(net_amount * share, 2),
                "is_late": index == 0 and net_amount > 0,
            }
            for index, ((member_id, member_name, event, event_date), share) in enumerate(zip(member_rows, shares, strict=True))
        ]

    def _build_settlement_approval_workflow(self, settlement: dict[str, Any]) -> list[dict[str, Any]]:
        status = settlement.get("status", "pending_approval")
        approved_at = settlement.get("approved_at") or self._settlement_last_updated(settlement)
        net_amount = abs(self._to_float(settlement.get("net_amount")))
        underwriting_status = "in_progress" if status == "disputed" else ("complete" if status == "approved" else "pending_review")
        compliance_status = (
            "complete"
            if status == "approved" and net_amount >= 500000
            else ("in_progress" if status == "disputed" else ("pending_review" if net_amount >= 500000 else "pending"))
        )
        treasury_status = "complete" if status == "approved" else ("pending_review" if status == "pending_approval" else "pending")
        return [
            {
                "stage": "Claims Ops",
                "owner": "Claims Ops",
                "rule": "All settlements",
                "status": "complete",
                "updated_at": self._settlement_last_updated(settlement),
            },
            {
                "stage": "Underwriting",
                "owner": "Underwriting",
                "rule": "Variance > 0.5% of leg",
                "status": underwriting_status,
                "updated_at": self._settlement_last_updated(settlement),
            },
            {
                "stage": "Compliance",
                "owner": "Compliance",
                "rule": "Variance > 500K",
                "status": compliance_status,
                "updated_at": self._settlement_last_updated(settlement),
            },
            {
                "stage": "Treasury",
                "owner": "Treasury",
                "rule": "Final payment release",
                "status": treasury_status,
                "updated_at": approved_at,
            },
        ]

    def _default_settlement_audit(self, settlement: dict[str, Any]) -> list[dict[str, Any]]:
        period_end = self._parse_iso_date(str(settlement.get("period_end") or "")) or date.today()
        base_timestamp = datetime.combine(period_end, datetime.min.time(), tzinfo=UTC) + timedelta(days=5)
        confidence = "91%" if abs(self._to_float(settlement.get("net_amount"))) >= 150000 else "87%"
        return [
            {
                "timestamp": self._to_iso(base_timestamp),
                "actor": "Settlement Engine",
                "type": "System",
                "action": "Settlement assembled",
                "detail": settlement["settlement_id"],
            },
            {
                "timestamp": self._to_iso(base_timestamp + timedelta(hours=3)),
                "actor": "Variance Review Agent",
                "type": "AI Agent",
                "action": "Variance analysis completed",
                "detail": f"confidence {confidence}",
            },
            {
                "timestamp": self._to_iso(base_timestamp + timedelta(hours=6)),
                "actor": "Claims Ops",
                "type": "Human",
                "action": "Queued for settlement review",
                "detail": settlement.get("period_label", ""),
            },
        ]

    def _hydrate_settlement_row(self, settlement: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
        current = deepcopy(settlement)
        override = overrides.get(current["settlement_id"], {})
        for key in (
            "status",
            "notes",
            "approved_at",
            "dispute_reason",
            "last_updated",
            "source",
            "cedent_name",
            "contract_name",
            "contract_version",
            "settlement_display_id",
            "contract_display_id",
            "iris_recommendation",
            "period_label",
            "period_start",
            "period_end",
            "payment_due_date",
            "direction",
            "currency",
            "fixed_leg_amount",
            "floating_leg_amount",
            "net_amount",
        ):
            if key in override:
                current[key] = override[key]
        current["audit_trail"] = override.get("audit_trail") or self._default_settlement_audit(current)
        return current

    def _create_settlement_worklist_item(
        self,
        settlement: dict[str, Any],
        *,
        priority: str,
        status: str,
        title: str,
        description: str,
        breadcrumb: str,
    ) -> None:
        logger.info("Creating settlement follow-up worklist item")
        logger.debug("Settlement worklist title=%s settlement_id=%s", title, settlement["settlement_id"])
        worklist_item = WorklistItem(
            wl_id=self.repository.get_next_worklist_id(),
            title=title,
            description=description,
            category="Settlement Review",
            priority=priority,
            status=status,
            assigned_role="claims_ops",
            cedent_id=settlement.get("cedent_id"),
            contract_id=settlement.get("contract_id"),
            source="Human",
            source_detail=settlement["settlement_id"],
            breadcrumb=breadcrumb,
        )
        self.repository.create_worklist_item(worklist_item)

    def _settlement_last_updated(self, settlement: dict[str, Any]) -> str:
        approved_at = settlement.get("approved_at")
        if isinstance(approved_at, str) and approved_at:
            return approved_at
        period_end = self._parse_iso_date(str(settlement.get("period_end") or "")) or date.today()
        return self._to_iso(datetime.combine(period_end, datetime.min.time(), tzinfo=UTC) + timedelta(days=12))

    def _settlement_sort_timestamp(self, settlement: dict[str, Any]) -> datetime:
        timestamp = str(settlement.get("last_updated") or self._settlement_last_updated(settlement) or "").strip()
        parsed = self._parse_iso_datetime(timestamp)
        return parsed or datetime.min.replace(tzinfo=UTC)

    def _read_settlement_override_store(self) -> dict[str, Any]:
        if not SETTLEMENT_OVERRIDES_FILE.exists():
            return {}
        with SETTLEMENT_OVERRIDES_FILE.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else {}

    def _write_settlement_override_store(self, store: dict[str, Any]) -> None:
        SETTLEMENT_OVERRIDES_FILE.parent.mkdir(parents=True, exist_ok=True)
        with SETTLEMENT_OVERRIDES_FILE.open("w", encoding="utf-8") as handle:
            json.dump(store, handle, indent=2)

    def _store_settlement_override(self, settlement_id: str, patch: dict[str, Any]) -> None:
        store = self._read_settlement_override_store()
        current = deepcopy(store.get(settlement_id, {}))
        current.update(patch)
        store[settlement_id] = current
        self._write_settlement_override_store(store)

    def _append_settlement_audit_event(self, settlement_id: str, event: dict[str, Any]) -> None:
        store = self._read_settlement_override_store()
        current = deepcopy(store.get(settlement_id, {}))
        base_settlement = next(
            (item for item in self._load_settlement_seed_rows() if item["settlement_id"] == settlement_id),
            {"settlement_id": settlement_id, "period_end": date.today().isoformat()},
        )
        audit_trail = list(current.get("audit_trail") or self._default_settlement_audit(base_settlement))
        audit_trail.append(
            {
                "timestamp": event.get("timestamp", self._to_iso(datetime.now(UTC))),
                "actor": event["actor"],
                "type": event["type"],
                "action": event["action"],
                "detail": event["detail"],
            }
        )
        current["audit_trail"] = audit_trail
        store[settlement_id] = current
        self._write_settlement_override_store(store)
        self._persist_claims_audit_event(
            module="settlement",
            entity_id=settlement_id,
            entity_type="settlement",
            event=event,
            contract_id=base_settlement.get("contract_id"),
            cedent_id=base_settlement.get("cedent_id"),
            settlement_id=settlement_id,
        )

    def _assumption_snapshot_label(self, currency: str) -> str:
        return f"{currency} assumptions v2025.Q2"

    def _build_calculation_payload(
        self,
        contract: Contract,
        calculation_type: str,
        period_start: date,
        period_end: date,
    ) -> dict[str, Any]:
        settlement = self._find_mock_settlement_for_period(contract.contract_id, period_start, period_end)
        quarter_count = self._quarters_inclusive(period_start, period_end)
        fixed_leg = self._to_float(settlement["fixed_leg_amount"]) if settlement else self._expected_fixed_leg_amount(contract) * quarter_count
        factor = self._calculation_factor(contract.contract_id, calculation_type)

        if settlement and calculation_type == "settlement":
            floating_leg = self._to_float(settlement["floating_leg_amount"])
        elif calculation_type == "fixed_leg":
            floating_leg = round(fixed_leg * (1 + factor * 0.6), 2)
        elif calculation_type == "floating_leg":
            floating_leg = round(fixed_leg * (1 + factor * 1.35), 2)
        elif calculation_type == "ae_ratio":
            floating_leg = round(fixed_leg * (1 + factor * 0.95), 2)
        else:
            floating_leg = round(fixed_leg * (1 + factor), 2)

        fixed_leg = round(fixed_leg, 2)
        floating_leg = round(floating_leg, 2)
        net = round(floating_leg - fixed_leg, 2)

        lives_start = int(contract.lives_count or 0)
        deaths_expected = round(max((lives_start or 12000) * 0.0022 * quarter_count, 0.4), 1)
        ae_ratio = round(1 + (factor * (1.2 if calculation_type == "ae_ratio" else 0.9)), 3)
        deaths_actual = max(int(round(deaths_expected * ae_ratio)), 1 if lives_start else 0)

        notional = self._to_float(contract.notional_amount)
        bel_previous = round(notional * 0.89, 2)
        per_life_reserve = max((notional / max(lives_start, 1)) if lives_start else 0, 1000)
        bel_change = round(-(deaths_actual - deaths_expected) * per_life_reserve * 0.4, 2)
        bel_current = round(bel_previous + bel_change, 2)

        return {
            "calculation_id": str(uuid.uuid4()),
            "contract_id": contract.contract_id,
            "period": self._format_calculation_period(period_start, period_end),
            "fixed_leg": fixed_leg,
            "floating_leg": floating_leg,
            "net": net,
            "ae_ratio": ae_ratio,
            "lives_start": lives_start,
            "deaths_actual": deaths_actual,
            "deaths_expected": deaths_expected,
            "bel_current": bel_current,
            "bel_previous": bel_previous,
            "bel_change": bel_change,
        }

    def _find_mock_settlement_for_period(
        self,
        contract_id: str,
        period_start: date,
        period_end: date,
    ) -> dict[str, Any] | None:
        return next(
            (
                item
                for item in self._load_settlements()
                if item.get("contract_id") == contract_id
                and item.get("period_start") == period_start.isoformat()
                and item.get("period_end") == period_end.isoformat()
            ),
            None,
        )

    def _quarters_inclusive(self, period_start: date, period_end: date) -> int:
        start_index = period_start.year * 4 + ((period_start.month - 1) // 3)
        end_index = period_end.year * 4 + ((period_end.month - 1) // 3)
        return max((end_index - start_index) + 1, 1)

    def _format_calculation_period(self, period_start: date, period_end: date) -> str:
        start_label = self._quarter_label(period_start)
        end_label = self._quarter_label(period_end)
        return start_label if start_label == end_label else f"{start_label} -> {end_label}"

    def _quarter_label(self, value: date) -> str:
        quarter = ((value.month - 1) // 3) + 1
        return f"Q{quarter} {value.year}"

    def _calculation_factor(self, contract_id: str, calculation_type: str) -> float:
        digits = [int(char) for char in contract_id if char.isdigit()]
        base_factor = 0.006 + ((sum(digits) % 6) * 0.0015)
        if calculation_type == "fixed_leg":
            return base_factor * 0.75
        if calculation_type == "floating_leg":
            return base_factor * 1.35
        if calculation_type == "ae_ratio":
            return base_factor * 1.1
        return base_factor

    def _parse_iso_date(self, value: str) -> date | None:
        if not value:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None

    def _parse_iso_datetime(self, value: str) -> datetime | None:
        if not value:
            return None
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            parsed_date = self._parse_iso_date(value)
            return datetime.combine(parsed_date, datetime.min.time(), tzinfo=UTC) if parsed_date else None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)

    def _to_date_string(self, value: date | None) -> str | None:
        return value.isoformat() if value else None

    def _columns_mapped_for_type(self, file_type: str | None) -> int:
        return {
            "Fixed Leg": 32,
            "Pension Status": 18,
            "Settlement": 9,
            "Mortality Report": 12,
            "Activity Report": 14,
            "Spouse Events": 16,
        }.get(file_type or "", 10)

    def _expected_fixed_leg_amount(self, contract: Contract) -> float:
        if contract.contract_id == "LSC-2025-002":
            return 8782055
        notional = float(contract.notional_amount or 0)
        rate = float(contract.fixed_leg_rate or 0)
        frequency_factor = 0.25 if (contract.fixed_leg_frequency or "").lower() == "quarterly" else 1.0
        return round(notional * rate * frequency_factor, 2)

    def _parse_csv_rows(self, content: str) -> list[dict[str, str]]:
        if not content.strip():
            return []
        reader = csv.DictReader(io.StringIO(content), delimiter=self._detect_tabular_delimiter(content))
        return [dict(row) for row in reader]

    def _count_records(self, filename: str, content: str) -> int:
        if not content.strip():
            return 0
        if filename.lower().endswith((".csv", ".xlsx", ".xlsm")):
            return len(self._parse_csv_rows(content))
        return max(len([line for line in content.splitlines() if line.strip()]) - 1, 0)

    def _sla_display(self, due_at: datetime | None) -> str:
        if due_at is None:
            return "â€”"
        if due_at.tzinfo is None:
            due_at = due_at.replace(tzinfo=UTC)
        delta = due_at - datetime.now(UTC)
        hours = max(int(delta.total_seconds() // 3600), 0)
        return f"{hours}h"

    def _mark_uploaded_file_detecting(self, file_id: str) -> None:
        stored = self._get_override(file_id)
        if stored.get("active_step") == "detect":
            self._store_override(file_id, {"active_step": "detect"})

    def _append_stage_history(self, file_id: str, stage: str) -> None:
        stored = self._get_override(file_id)
        history = list(stored.get("stage_history", []))
        if any(item["stage"] == stage for item in history):
            return
        history.append({"stage": stage, "completed_at": self._to_iso(datetime.now(UTC))})
        self._store_override(file_id, {"stage_history": history})

    def _append_stage_log(self, file_id: str, stage: str, status: str, timestamp: datetime | None = None) -> None:
        stored = self._get_override(file_id)
        stage_log = list(stored.get("stage_log", []))
        stage_key = stage.replace("-", "_")
        event = {
            "stage": stage_key,
            "status": status,
            "timestamp": self._to_iso(timestamp or datetime.now(UTC)),
        }
        stage_log = [item for item in stage_log if item["stage"] != stage_key]
        stage_log.append(event)
        stage_log.sort(key=lambda item: PIPELINE_STEPS.index(item["stage"].replace("_", "-")))
        self._store_override(file_id, {"stage_log": stage_log})

    def _append_audit_event(self, file_id: str, event: dict[str, Any]) -> None:
        stored = self._get_override(file_id)
        audit_events = list(stored.get("audit_events", []))
        audit_events.append(
            {
                "timestamp": event.get("timestamp", self._to_iso(datetime.now(UTC))),
                "actor": event["actor"],
                "type": event["type"],
                "action": event["action"],
                "detail": event["detail"],
            }
        )
        self._store_override(file_id, {"audit_events": audit_events})
        cession_file = self.repository.get_cession_file(file_id)
        self._persist_claims_audit_event(
            module="cession",
            entity_id=file_id,
            entity_type="cession_file",
            event=event,
            contract_id=cession_file.contract_id if cession_file else None,
            cedent_id=cession_file.cedent_id if cession_file else None,
            cession_file_id=cession_file.id if cession_file else None,
        )

    def _load_cession_audit_events(self, cession_file: CessionFile) -> list[dict[str, Any]]:
        events = self.repository.list_audit_events_for_cession_file(cession_file.file_id, cession_file.id)
        return [self._serialize_claims_audit_event(event) for event in events[:20]]

    def _load_settlement_audit_trail(self, settlement: dict[str, Any]) -> list[dict[str, Any]]:
        settlement_id = settlement.get("settlement_id")
        if not settlement_id:
            return []
        events = self.repository.list_audit_events_for_settlement(settlement_id)
        return [self._serialize_claims_audit_event(event) for event in events[:20]]

    def _serialize_claims_audit_event(self, event: AuditEvent) -> dict[str, Any]:
        return {
            "timestamp": self._to_iso(event.timestamp),
            "actor": event.actor_id or self._claims_actor_name(event.actor_type),
            "type": self._claims_actor_label(event.actor_type),
            "action": event.event_type,
            "detail": event.description,
        }

    def _persist_claims_audit_event(
        self,
        *,
        module: str,
        entity_id: str,
        entity_type: str,
        event: dict[str, Any],
        contract_id: str | None = None,
        cedent_id: str | None = None,
        cession_file_id: str | None = None,
        settlement_id: str | None = None,
    ) -> None:
        timestamp = self._parse_claims_audit_timestamp(event.get("timestamp"))
        logger.info("Persisting claims audit event")
        logger.debug(
            "Claims audit persist module=%s entity_id=%s contract_id=%s settlement_id=%s",
            module,
            entity_id,
            contract_id,
            settlement_id,
        )
        self.repository.create_audit_event(
            AuditEvent(
                audit_id=self.repository.get_next_audit_id(timestamp.astimezone(UTC).strftime("%Y-%m-%d")),
                timestamp=timestamp,
                module=module,
                event_type=event.get("action") or "Audit Event",
                actor_type=self._claims_actor_type(event),
                actor_id=event.get("actor"),
                entity_id=entity_id,
                entity_type=entity_type,
                description=event.get("detail") or event.get("action") or "Audit Event",
                approval_status=self._claims_approval_status(event.get("action")),
                contract_id=contract_id,
                cedent_id=cedent_id,
                cession_file_id=cession_file_id,
                settlement_id=settlement_id,
            )
        )

    def _parse_claims_audit_timestamp(self, value: Any) -> datetime:
        if not isinstance(value, str) or not value:
            return datetime.now(UTC)
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)

    def _claims_actor_type(self, event: dict[str, Any]) -> str:
        explicit_type = str(event.get("type") or "").strip().lower()
        if explicit_type in {"human", "manual"}:
            return "human"
        if explicit_type in {"ai", "ai agent"}:
            return "ai"
        if explicit_type == "system":
            return "system"

        actor = str(event.get("actor") or "").lower()
        if "agent" in actor or actor.startswith("ai "):
            return "ai"
        if any(keyword in actor for keyword in ["engine", "system", "listener", "orchestrator", "router"]):
            return "system"
        return "human"

    def _claims_approval_status(self, action: Any) -> str:
        normalized = str(action or "").lower()
        if "approved" in normalized:
            return "approved"
        if "rejected" in normalized or "disputed" in normalized:
            return "rejected"
        if "review" in normalized or "hold" in normalized or "queued" in normalized:
            return "pending"
        return "n/a"

    def _claims_actor_name(self, actor_type: str) -> str:
        return {"human": "Claims Ops", "ai": "IRiS Agent", "system": "System"}.get(actor_type, "System")

    def _claims_actor_label(self, actor_type: str) -> str:
        return {"human": "Human", "ai": "AI Agent", "system": "System"}.get(actor_type, "System")

    def _get_cession_file_or_error(self, file_id: str) -> CessionFile:
        cession_file = self.repository.get_cession_file(file_id)
        if cession_file is None:
            logger.error("Requested cession file was not found file_id=%s", file_id)
            raise IrisAPIError(404, "Invalid file ID", "Cession file not found in DB")
        return cession_file

    def _get_override(self, file_id: str) -> dict[str, Any]:
        store = self._read_override_store()
        return deepcopy(store.get(file_id, {}))

    def _store_override(self, file_id: str, patch: dict[str, Any]) -> None:
        store = self._read_override_store()
        current = deepcopy(store.get(file_id, {}))
        current.update(patch)
        store[file_id] = current
        self._write_override_store(store)

    def _read_override_store(self) -> dict[str, Any]:
        if not PIPELINE_OVERRIDES_FILE.exists():
            return {}
        with PIPELINE_OVERRIDES_FILE.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else {}

    def _write_override_store(self, store: dict[str, Any]) -> None:
        PIPELINE_OVERRIDES_FILE.parent.mkdir(parents=True, exist_ok=True)
        with PIPELINE_OVERRIDES_FILE.open("w", encoding="utf-8") as handle:
            json.dump(store, handle, indent=2)

    def _to_iso(self, value: datetime | None) -> str:
        if value is None:
            return ""
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")

    def _to_float(self, value: Any) -> float:
        if value is None:
            return 0.0
        if isinstance(value, Decimal):
            return float(value)
        return float(value)
