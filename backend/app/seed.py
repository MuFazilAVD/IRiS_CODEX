from __future__ import annotations

import logging
from datetime import UTC, datetime

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
from app.models.user import User
from app.models.worklist import WorklistItem
from app.services.auth_service import AuthService
from app.repositories.auth_repository import AuthRepository


logger = logging.getLogger(__name__)


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

    if db.scalar(select(ScreeningCacheList.id).limit(1)) is None:
        logger.debug("Seeding screening_cache_lists table from mock data")
        for record in load_mock_data("screening_cache_lists_seed.json"):
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

    if db.scalar(select(AuditEvent.id).limit(1)) is None:
        logger.debug("Seeding audit_events table from admin access-log bootstrap data")
        admin_state = load_mock_data("admin_state.json")
        for index, record in enumerate(admin_state.get("access_logs", []), start=1):
            timestamp = datetime.fromisoformat(record["timestamp"].replace("Z", "+00:00"))
            db.add(
                AuditEvent(
                    audit_id=f"AUD-{timestamp.strftime('%Y-%m-%d')}-{index:03d}",
                    timestamp=timestamp,
                    module="access",
                    event_type=record["action"],
                    actor_type="system" if record.get("user") == "system" else "human",
                    actor_id=record.get("user"),
                    entity_id=record.get("resource"),
                    entity_type="route",
                    description=f'{record.get("action", "VIEW")} {record.get("resource", "")}'.strip(),
                    approval_status="n/a",
                    ip_address=record.get("ip"),
                )
            )

    db.commit()
