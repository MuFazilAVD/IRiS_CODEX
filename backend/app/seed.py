from __future__ import annotations

from collections import defaultdict
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.mock_data_loader import load_mock_data
from app.models.audit_event import AuditEvent
from app.models.cedent import Cedent
from app.models.cession_file import CessionFile
from app.models.contract import Contract
from app.models.population import PolicyRegister
from app.models.reference_data_version import ReferenceDataVersion
from app.models.report import Report
from app.models.screening_cache_list import ScreeningCacheList
from app.models.screening_event import ScreeningEvent
from app.models.user import User
from app.models.worklist import WorklistItem
from app.services.auth_service import AuthService
from app.repositories.auth_repository import AuthRepository


logger = logging.getLogger(__name__)
UTC = timezone.utc


def seed_database(db: Session) -> None:
    logger.info("Seeding local bootstrap data")
    auth_service = AuthService(AuthRepository(db))

    if db.scalar(select(User.id).limit(1)) is None:
        logger.debug("Seeding users table from mock data")
        for record in load_mock_data("users_seed.json"):
            db.add(
                User(
                    username=record["email"].split("@")[0],
                    email=record["email"],
                    full_name=record["full_name"],
                    role=record["role"],
                    password_hash=auth_service.hash_password(record["password"]),
                    is_active=record.get("is_active", True),
                    last_login=(
                        datetime.fromisoformat(record["last_login"].replace("Z", "+00:00"))
                        if record.get("last_login")
                        else None
                    ),
                )
            )

    if db.scalar(select(Cedent.cedent_id).limit(1)) is None:
        logger.debug("Seeding cedents table from mock data")
        for record in load_mock_data("cedents_seed.json"):
            db.add(
                Cedent(
                    cedent_id=record["cedent_id"],
                    legal_entity_name=record["legal_entity_name"],
                    trading_name=record.get("trading_name"),
                    lei=record.get("lei"),
                    entity_type=record.get("entity_type"),
                    jurisdiction=record.get("jurisdiction"),
                    country_of_registration=record.get("country"),
                    date_of_incorporation=(
                        datetime.fromisoformat(record["date_of_incorporation"]).date()
                        if record.get("date_of_incorporation")
                        else None
                    ),
                    regulatory_status=record.get("regulatory_status"),
                    aum_amount=record.get("aum_amount"),
                    aum_currency=record.get("aum_currency", "USD"),
                    status=record.get("status", "onboarding"),
                    screening_status=record.get("screening_status", "pending"),
                    onboarded_date=(
                        datetime.fromisoformat(record["onboarded_date"]).date()
                        if record.get("onboarded_date")
                        else None
                    ),
                    is_active=record.get("status") != "inactive",
                )
            )

    if db.scalar(select(Contract.contract_id).limit(1)) is None:
        logger.debug("Seeding contracts table from mock data")
        for record in load_mock_data("contracts_seed.json"):
            db.add(
                Contract(
                    contract_id=record["contract_id"],
                    contract_name=record["contract_name"],
                    contract_version=record.get("contract_version", "v1.0"),
                    cedent_id=record["cedent_id"],
                    swap_type=record.get("swap_type"),
                    structure=record.get("structure"),
                    master_agreement_ref=record.get("master_agreement_ref"),
                    inception_date=datetime.fromisoformat(record["inception_date"]).date(),
                    effective_date=(
                        datetime.fromisoformat(record["effective_date"]).date()
                        if record.get("effective_date")
                        else None
                    ),
                    maturity_date=datetime.fromisoformat(record["maturity_date"]).date(),
                    duration_years=record.get("duration_years"),
                    governing_law=record.get("governing_law"),
                    jurisdiction=record.get("jurisdiction"),
                    status=record.get("status", "active"),
                    notional_amount=record.get("notional_amount"),
                    currency=record.get("currency"),
                    fixed_leg_rate=record.get("fixed_leg_rate"),
                    fixed_leg_frequency=record.get("fixed_leg_frequency"),
                    floating_leg_definition=record.get("floating_leg_definition"),
                    floating_leg_index=record.get("floating_leg_index"),
                    lives_count=record.get("lives_count"),
                )
            )

    if db.scalar(select(PolicyRegister.id).limit(1)) is None:
        logger.debug("Seeding policy register table from mock data")
        for record in load_mock_data("population_seed.json"):
            db.add(
                PolicyRegister(
                    contract_id=record["contract_id"],
                    member_id=record["member_id"],
                    policy_id=record.get("policy_id"),
                    date_of_birth=datetime.fromisoformat(record["date_of_birth"]).date(),
                    gender=record["gender"],
                    smoker_status=record.get("smoker_status"),
                    postcode=record.get("postcode"),
                    annual_pension=record["annual_pension"],
                    pension_currency=record.get("pension_currency", "GBP"),
                    escalation_type=record.get("escalation_type"),
                    escalation_rate=record.get("escalation_rate"),
                    status=record.get("status", "active"),
                    date_of_death=(
                        datetime.fromisoformat(record["date_of_death"]).date()
                        if record.get("date_of_death")
                        else None
                    ),
                    commencement_date=(
                        datetime.fromisoformat(record["commencement_date"]).date()
                        if record.get("commencement_date")
                        else None
                    ),
                    effective_from=datetime.fromisoformat(record["effective_from"]).date(),
                    effective_to=(
                        datetime.fromisoformat(record["effective_to"]).date()
                        if record.get("effective_to")
                        else None
                    ),
                    is_current=record.get("is_current", True),
                    source_cession_file_id=record.get("source_cession_file_id"),
                )
            )

    if db.scalar(select(CessionFile.id).limit(1)) is None:
        logger.debug("Seeding cession files table from mock data")
        for record in load_mock_data("cession_files_seed.json"):
            db.add(
                CessionFile(
                    file_id=record["file_id"],
                    contract_id=record["contract_id"],
                    cedent_id=record["cedent_id"],
                    filename=record["filename"],
                    file_type=record["file_type"],
                    record_count=record["records"],
                    received_at=datetime.fromisoformat(record["received_at"].replace("Z", "+00:00")),
                    received_via=record.get("received_via", "Manual Upload"),
                    stage=record["stage"],
                    error_count=record.get("error_count", 0),
                    warning_count=record.get("warning_count", 0),
                    critical_count=record.get("critical_count", 0),
                    sla_deadline=datetime.fromisoformat(record["sla_deadline"].replace("Z", "+00:00")),
                    created_at=datetime.now(UTC),
                    updated_at=datetime.now(UTC),
                )
            )

    if db.scalar(select(WorklistItem.id).limit(1)) is None:
        logger.debug("Seeding worklist items table from mock data")
        for record in load_mock_data("worklist_seed.json"):
            db.add(
                WorklistItem(
                    wl_id=record["wl_id"],
                    title=record["title"],
                    description=record["description"],
                    category=record["category"],
                    priority=record["priority"],
                    status=record["status"],
                    assigned_role=record["assigned_role"],
                    contract_id=record.get("contract_id"),
                    cedent_id=record.get("cedent_id"),
                    source=record.get("source"),
                    source_detail=record.get("source"),
                    sla_deadline=datetime.fromisoformat(record["sla_deadline"].replace("Z", "+00:00")),
                    elapsed_minutes=record.get("elapsed_minutes"),
                    compliance_hold=record.get("compliance_hold", False),
                    ai_generated=record.get("ai_generated", False),
                    breadcrumb=record.get("breadcrumb"),
                )
            )

    if db.scalar(select(Report.id).limit(1)) is None:
        logger.debug("Seeding reports table from mock data")
        for record in load_mock_data("reports_seed.json"):
            db.add(
                Report(
                    report_id=record["report_id"],
                    name=record["name"],
                    description=record.get("description"),
                    category=record["category"],
                    cadence=record.get("cadence"),
                    distribution=record.get("distribution", []),
                    sensitivity=record.get("sensitivity", "Standard"),
                    roles_with_access=record.get("roles_with_access", []),
                    is_active=record.get("is_active", True),
                )
            )

    if db.scalar(select(ReferenceDataVersion.id).limit(1)) is None:
        logger.debug("Seeding reference_data_versions table from mock data")
        for record in load_mock_data("reference_data_versions_seed.json"):
            db.add(
                ReferenceDataVersion(
                    ref_id=record["ref_id"],
                    data_type=record["data_type"],
                    name=record["name"],
                    source=record.get("source"),
                    version=record["version"],
                    effective_date=datetime.fromisoformat(record["effective_date"]).date(),
                    status=record.get("status", "active"),
                    is_locked=record.get("is_locked", False),
                    contracts_using=record.get("contracts_using", 0),
                    data_payload=record.get("data_payload"),
                    file_path=record.get("file_path"),
                    notes=record.get("notes"),
                )
            )

    screening_cache_seed = load_mock_data("screening_cache_lists_seed.json")
    if db.scalar(select(ScreeningCacheList.id).limit(1)) is None:
        logger.debug("Seeding screening_cache_lists table from mock data")
        for record in screening_cache_seed:
            db.add(
                ScreeningCacheList(
                    list_name=record["list_name"],
                    provider=record["provider"],
                    record_count=record.get("record_count", 0),
                    last_sync=(
                        datetime.fromisoformat(record["last_sync"].replace("Z", "+00:00"))
                        if record.get("last_sync")
                        else None
                    ),
                    status=record.get("status", "active"),
                    data_payload=record.get("data_payload"),
                )
            )
    else:
        logger.debug("Backfilling screening_cache_lists seed payloads where older bootstrap rows are missing entries")
        existing_cache_lists = {
            item.list_name: item
            for item in db.scalars(select(ScreeningCacheList))
        }
        for record in screening_cache_seed:
            existing = existing_cache_lists.get(record["list_name"])
            if existing is None:
                continue
            existing_payload = existing.data_payload or {}
            if existing_payload.get("entries"):
                continue
            existing.provider = record["provider"]
            existing.record_count = record.get("record_count", 0)
            existing.last_sync = (
                datetime.fromisoformat(record["last_sync"].replace("Z", "+00:00"))
                if record.get("last_sync")
                else None
            )
            existing.status = record.get("status", "active")
            existing.data_payload = record.get("data_payload")
            existing.updated_at = datetime.now(UTC)

    if db.scalar(select(ScreeningEvent.id).limit(1)) is None:
        logger.debug("Seeding screening_events table from mock data")
        for record in load_mock_data("screening_events_seed.json"):
            db.add(
                ScreeningEvent(
                    screening_ref=record["screening_ref"],
                    trigger_type=record["trigger_type"],
                    entity_name=record["entity_name"],
                    entity_type=record.get("entity_type"),
                    cedent_id=record.get("cedent_id"),
                    contract_id=record.get("contract_id"),
                    cession_file_id=record.get("cession_file_id"),
                    member_id=record.get("member_id"),
                    keyword_match=record.get("keyword_match", False),
                    matched_lists=record.get("matched_lists", []),
                    llm_called=record.get("llm_called", False),
                    llm_confidence=record.get("llm_confidence"),
                    llm_reasoning=record.get("llm_reasoning"),
                    llm_is_genuine=record.get("llm_is_genuine"),
                    result=record.get("result", "pending"),
                    reviewed_by=record.get("reviewed_by"),
                    reviewed_at=(
                        datetime.fromisoformat(record["reviewed_at"].replace("Z", "+00:00"))
                        if record.get("reviewed_at")
                        else None
                    ),
                    review_outcome=record.get("review_outcome"),
                    review_notes=record.get("review_notes"),
                    created_at=datetime.fromisoformat(record["created_at"].replace("Z", "+00:00")),
                    updated_at=datetime.fromisoformat(record["updated_at"].replace("Z", "+00:00")),
                )
            )

    db.flush()
    _seed_audit_events(db)

    db.commit()


def _seed_audit_events(db: Session) -> None:
    logger.debug("Ensuring audit_events table is seeded from audit seed and module trails")
    existing_ids = {value for value in db.scalars(select(AuditEvent.audit_id))}
    for record in _build_audit_event_seed_records(db):
        if record["audit_id"] in existing_ids:
            continue
        db.add(
            AuditEvent(
                audit_id=record["audit_id"],
                timestamp=record["timestamp"],
                module=record["module"],
                event_type=record["event_type"],
                actor_type=record["actor_type"],
                actor_id=record.get("actor_id"),
                entity_id=record.get("entity_id"),
                entity_type=record.get("entity_type"),
                description=record["description"],
                financial_impact_amount=record.get("financial_impact_amount"),
                financial_impact_currency=record.get("financial_impact_currency"),
                is_high_impact=record.get("is_high_impact", False),
                approval_status=record.get("approval_status", "n/a"),
                is_sensitive=record.get("is_sensitive", False),
                contract_id=record.get("contract_id"),
                cedent_id=record.get("cedent_id"),
                cession_file_id=record.get("cession_file_id"),
                settlement_id=record.get("settlement_id"),
                ip_address=record.get("ip_address"),
                session_id=record.get("session_id"),
            )
        )
        existing_ids.add(record["audit_id"])


def _build_audit_event_seed_records(db: Session) -> list[dict[str, Any]]:
    contracts_by_id = {item.contract_id: item for item in db.scalars(select(Contract))}
    cedents_by_id = {item.cedent_id: item for item in db.scalars(select(Cedent))}
    cession_files_by_file_id = {item.file_id: item for item in db.scalars(select(CessionFile))}
    settlement_overrides = load_mock_data("settlement_overrides.json")
    created_settlement_rows = settlement_overrides.get("__created_rows__", {})

    deduped: dict[tuple[str, str, str, str, str, str], dict[str, Any]] = {}

    def add_record(record: dict[str, Any]) -> None:
        key = (
            record["timestamp"].astimezone(UTC).isoformat(),
            record["module"],
            record["event_type"],
            record.get("actor_id") or "",
            record.get("entity_id") or "",
            record["description"],
        )
        deduped.setdefault(key, record)

    for record in load_mock_data("audit_events_seed.json"):
        add_record(
            _build_audit_record(
                timestamp=record.get("timestamp"),
                module=record.get("module") or "access",
                event_type=record.get("event_type") or "Audit Event",
                actor_type=record.get("actor_type"),
                actor_id=record.get("actor_id"),
                entity_id=record.get("entity_id"),
                entity_type=record.get("entity_type"),
                description=record.get("description") or record.get("event_type") or "Audit Event",
                approval_status=record.get("approval_status"),
                is_high_impact=record.get("is_high_impact", False),
                financial_impact_amount=record.get("financial_impact_amount"),
                financial_impact_currency=record.get("financial_impact_currency"),
                is_sensitive=record.get("event_type") == "Sensitive Export",
                contract_id=record.get("contract_id") or (_normalize_contract_id(record.get("entity_type"), record.get("entity_id"))),
                cedent_id=record.get("cedent_id"),
                cession_file_id=(cession_files_by_file_id.get(str(record.get("entity_id") or "")).id if record.get("entity_type") == "cession_file" and cession_files_by_file_id.get(str(record.get("entity_id") or "")) else None),
                settlement_id=record.get("settlement_id") or (_normalize_settlement_id(record.get("entity_type"), record.get("entity_id"))),
                audit_id=record.get("audit_id"),
            )
        )

    admin_state = load_mock_data("admin_state.json")
    for record in admin_state.get("access_logs", []):
        add_record(
            _build_audit_record(
                timestamp=record.get("timestamp"),
                module="access",
                event_type=record.get("action") or "VIEW",
                actor_type="system" if record.get("user") == "system" else "human",
                actor_id=record.get("user"),
                entity_id=record.get("resource"),
                entity_type="route",
                description=f'{record.get("action", "VIEW")} {record.get("resource", "")}'.strip(),
                approval_status="n/a",
                ip_address=record.get("ip"),
            )
        )

    for cedent_id, detail in load_mock_data("cedent_detail_overrides.json").items():
        if cedent_id not in cedents_by_id:
            continue
        for event in detail.get("audit_approval", []):
            add_record(
                _build_audit_record(
                    timestamp=event.get("timestamp"),
                    module="contract",
                    event_type=event.get("action") or "Cedent Audit Event",
                    actor_type=_infer_actor_type(event.get("type"), event.get("actor")),
                    actor_id=event.get("actor"),
                    entity_id=cedent_id,
                    entity_type="cedent",
                    description=event.get("detail") or event.get("action") or "",
                    approval_status=_infer_approval_status(event.get("action")),
                    cedent_id=cedent_id,
                )
            )

    for contract_id, detail in load_mock_data("contract_detail_overrides.json").items():
        contract = contracts_by_id.get(contract_id)
        cedent_id = contract.cedent_id if contract else None
        for event in detail.get("audit_approval", []):
            add_record(
                _build_audit_record(
                    timestamp=event.get("timestamp"),
                    module="contract",
                    event_type=event.get("action") or "Contract Audit Event",
                    actor_type=_infer_actor_type(event.get("type"), event.get("actor")),
                    actor_id=event.get("actor"),
                    entity_id=contract_id,
                    entity_type="contract",
                    description=event.get("detail") or event.get("action") or "",
                    approval_status=_infer_approval_status(event.get("action")),
                    contract_id=contract_id,
                    cedent_id=cedent_id,
                )
            )
        for event in detail.get("audit_compliance", {}).get("audit_trail", []):
            add_record(
                _build_audit_record(
                    timestamp=event.get("timestamp"),
                    module="cession",
                    event_type=event.get("action") or "Operational Audit Event",
                    actor_type=_infer_actor_type(event.get("type"), event.get("actor")),
                    actor_id=event.get("actor"),
                    entity_id=contract_id,
                    entity_type="contract",
                    description=event.get("detail") or event.get("action") or "",
                    approval_status="n/a",
                    contract_id=contract_id,
                    cedent_id=cedent_id,
                )
            )

    for file_id, detail in load_mock_data("cession_pipeline_overrides.json").items():
        cession_file = cession_files_by_file_id.get(file_id)
        contract_id = ((detail.get("contract_override") or {}).get("contract_id")) or (cession_file.contract_id if cession_file else None)
        cedent_id = ((detail.get("detection_override") or {}).get("cedent_id")) or (cession_file.cedent_id if cession_file else None)
        cession_file_db_id = cession_file.id if cession_file else None
        for event in detail.get("audit_events", []):
            add_record(
                _build_audit_record(
                    timestamp=event.get("timestamp"),
                    module="cession",
                    event_type=event.get("action") or "Cession Audit Event",
                    actor_type=_infer_actor_type(event.get("type"), event.get("actor")),
                    actor_id=event.get("actor"),
                    entity_id=file_id,
                    entity_type="cession_file",
                    description=event.get("detail") or event.get("action") or "",
                    approval_status="n/a",
                    contract_id=contract_id,
                    cedent_id=cedent_id,
                    cession_file_id=cession_file_db_id,
                )
            )

    for settlement_id, detail in settlement_overrides.items():
        if settlement_id == "__created_rows__":
            continue
        created_row = created_settlement_rows.get(settlement_id, {})
        contract_id = detail.get("contract_id") or created_row.get("contract_id")
        cedent_id = detail.get("cedent_id") or created_row.get("cedent_id")
        for event in detail.get("audit_trail", []):
            add_record(
                _build_audit_record(
                    timestamp=event.get("timestamp"),
                    module="settlement",
                    event_type=event.get("action") or "Settlement Audit Event",
                    actor_type=_infer_actor_type(event.get("type"), event.get("actor")),
                    actor_id=event.get("actor"),
                    entity_id=settlement_id,
                    entity_type="settlement",
                    description=event.get("detail") or event.get("action") or "",
                    approval_status=_infer_approval_status(event.get("action")),
                    contract_id=contract_id,
                    cedent_id=cedent_id,
                    settlement_id=settlement_id,
                )
            )

    records = sorted(
        deduped.values(),
        key=lambda item: (
            item["timestamp"].astimezone(UTC).isoformat(),
            item["module"],
            item.get("entity_id") or "",
            item["event_type"],
        ),
    )
    _assign_generated_audit_ids(records)
    return records


def _build_audit_record(
    *,
    timestamp: str | None,
    module: str,
    event_type: str,
    actor_type: str | None,
    actor_id: str | None,
    entity_id: str | None,
    entity_type: str | None,
    description: str,
    approval_status: str | None,
    is_high_impact: bool = False,
    financial_impact_amount: Any | None = None,
    financial_impact_currency: str | None = None,
    is_sensitive: bool = False,
    contract_id: str | None = None,
    cedent_id: str | None = None,
    cession_file_id: str | None = None,
    settlement_id: str | None = None,
    ip_address: str | None = None,
    session_id: str | None = None,
    audit_id: str | None = None,
) -> dict[str, Any]:
    return {
        "audit_id": audit_id,
        "timestamp": _parse_timestamp(timestamp),
        "module": module,
        "event_type": event_type,
        "actor_type": actor_type or "human",
        "actor_id": actor_id,
        "entity_id": entity_id,
        "entity_type": entity_type,
        "description": description,
        "financial_impact_amount": financial_impact_amount,
        "financial_impact_currency": financial_impact_currency,
        "is_high_impact": is_high_impact,
        "approval_status": approval_status or "n/a",
        "is_sensitive": is_sensitive,
        "contract_id": contract_id,
        "cedent_id": cedent_id,
        "cession_file_id": cession_file_id,
        "settlement_id": settlement_id,
        "ip_address": ip_address,
        "session_id": session_id,
    }


def _assign_generated_audit_ids(records: list[dict[str, Any]]) -> None:
    counters: dict[str, int] = defaultdict(int)
    for record in records:
        audit_id = record.get("audit_id")
        if not audit_id:
            continue
        parts = audit_id.split("-")
        if len(parts) >= 5:
            date_key = "-".join(parts[1:4])
            try:
                counters[date_key] = max(counters[date_key], int(parts[4]))
            except ValueError:
                continue

    for record in records:
        if record.get("audit_id"):
            continue
        date_key = record["timestamp"].astimezone(UTC).strftime("%Y-%m-%d")
        counters[date_key] += 1
        record["audit_id"] = f"AUD-{date_key}-{counters[date_key]:03d}"


def _parse_timestamp(value: str | None) -> datetime:
    if not value:
        return datetime.now(UTC)
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _infer_actor_type(explicit_type: str | None, actor: str | None) -> str:
    explicit = (explicit_type or "").strip().lower()
    if explicit in {"human", "manual"}:
        return "human"
    if explicit in {"ai", "ai agent"}:
        return "ai"
    if explicit == "system":
        return "system"

    actor_text = (actor or "").lower()
    if "agent" in actor_text or " ai" in actor_text or actor_text.startswith("ai "):
        return "ai"
    if any(keyword in actor_text for keyword in ["system", "engine", "listener", "orchestrator", "router"]):
        return "system"
    return "human"


def _infer_approval_status(action: str | None) -> str:
    normalized = (action or "").lower()
    if "approved" in normalized or "completed compliance review" in normalized:
        return "approved"
    if "rejected" in normalized:
        return "rejected"
    if "pending" in normalized or "queued" in normalized or "review" in normalized:
        return "pending"
    return "n/a"


def _normalize_contract_id(entity_type: str | None, entity_id: str | None) -> str | None:
    if entity_type == "contract":
        return entity_id
    return None


def _normalize_settlement_id(entity_type: str | None, entity_id: str | None) -> str | None:
    if entity_type == "settlement":
        return entity_id
    return None
