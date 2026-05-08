from __future__ import annotations

import csv
import json
import logging
import re
from copy import deepcopy
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any


logger = logging.getLogger(__name__)

SETTLEMENT_REPORT_REPOSITORY_DIR = Path(__file__).resolve().parent.parent / "generated_reports" / "settlements"
SETTLEMENT_REPORT_REGISTRY_FILE = Path(__file__).resolve().parent.parent / "mock_data" / "settlement_report_artifacts.json"

SETTLEMENT_REPORT_ROLES = ["claims_ops", "admin", "super_admin"]

CASH_TRACKER_COLUMNS = [
    "Treaty ID",
    "Cedant",
    "Case Name",
    "Accounting Period End Date",
    "Payment Due Date",
    "Date Received",
    "Quarter",
    "Payment Late",
    "FY/RY Code",
    "Fixed Leg (GBP)",
    "Floating Leg (GBP)",
    "Fee (GBP)",
    "Interest (If applicable)",
    "GBP Premium",
    "GBP Claim",
    "GBP Amount Received",
    "USD Premium",
    "USD Claim",
    "USD Received",
    "Exchange Rate",
    "Amount Received = Amount Due",
    "PeopleSoft Journal ID",
    "GRDR Source Code",
    "Bank Account",
    "Comments",
]

GRDR_LOAD_COLUMNS = [
    "Treaty ID",
    "Legal Entity Code",
    "Coverage Type Code",
    "Product Line Code",
    "Subsegment",
    "Closed Block Sub Segment",
    "Closed Block Ind",
    "Renewal Code",
    "Contract Participation Code",
    "Pension Indicator",
    "Reinsurance Distribution",
    "Experience Number",
    "Months Settled Count",
    "Paid to Date",
    "Open Item Key",
    "Description",
    "Original Bill Date",
    "Currency Code",
    "Exchange Method",
    "Exchange Date",
    "Exchange Rate",
    "CHARTFIELD3",
    "Contract Number",
    "Contract Sub Number",
    "Contract Suffix",
    "Intercompany Accounting",
    "Cash Legal Entity",
    "Cash Accounting Number",
    "Sub product code2",
    "Inforce Count",
    "Funds Withheld",
    "Misc Interest Exp",
    "Premium",
    "Paid Claim",
    "Expense Allowance",
    "Commission",
    "Modco Adjust",
    "Experience Refund",
    "Premium Tax",
    "Claim Interest",
    "Misc Interest Income",
    "Erdr Unpaid Claims",
    "Premium Reversal",
    "Net Due",
]


def generate_settlement_report_files(
    *,
    cession_file: Any,
    contract: Any,
    cedent_name: str,
    settlement_row: dict[str, Any],
    reconciliation: dict[str, Any],
    generated_at: datetime,
) -> list[dict[str, Any]]:
    logger.info("Generating Settlement report output files")
    logger.debug(
        "Settlement report generation file_id=%s settlement_id=%s contract_id=%s",
        getattr(cession_file, "file_id", None),
        settlement_row.get("settlement_id"),
        getattr(contract, "contract_id", None),
    )

    context = _build_settlement_report_context(cession_file, contract, cedent_name, settlement_row, reconciliation, generated_at)
    SETTLEMENT_REPORT_REPOSITORY_DIR.mkdir(parents=True, exist_ok=True)

    artifacts = [
        _write_csv_artifact(
            context,
            artifact_type="cash_settlements_tracker",
            display_name="Cash Settlements Tracker",
            columns=CASH_TRACKER_COLUMNS,
            rows=[_cash_tracker_row(context)],
        ),
        _write_csv_artifact(
            context,
            artifact_type="grdr_load_form",
            display_name="GRDR Load Form",
            columns=GRDR_LOAD_COLUMNS,
            rows=_grdr_load_rows(context),
        ),
    ]
    _upsert_artifacts(artifacts)
    logger.info("Generated Settlement report output files")
    logger.debug("Settlement report artifacts=%s", artifacts)
    return artifacts


def list_settlement_report_artifacts(role: str) -> list[dict[str, Any]]:
    artifacts = _read_registry()
    accessible = [
        artifact
        for artifact in artifacts
        if role == "super_admin" or role in artifact.get("roles_with_access", SETTLEMENT_REPORT_ROLES)
    ]
    accessible.sort(key=lambda item: str(item.get("generated_at") or ""), reverse=True)
    return accessible


def get_settlement_report_artifact(artifact_id: str, role: str) -> dict[str, Any] | None:
    for artifact in list_settlement_report_artifacts(role):
        if artifact.get("artifact_id") == artifact_id:
            return artifact
    return None


def read_settlement_report_artifact_file(artifact: dict[str, Any]) -> bytes:
    relative_path = Path(str(artifact.get("path") or ""))
    file_path = (SETTLEMENT_REPORT_REPOSITORY_DIR.parent.parent / relative_path).resolve()
    repository_root = SETTLEMENT_REPORT_REPOSITORY_DIR.resolve()
    if repository_root not in file_path.parents and file_path != repository_root:
        logger.error("Settlement report artifact path escaped repository artifact_id=%s path=%s", artifact.get("artifact_id"), file_path)
        raise FileNotFoundError("Invalid settlement report artifact path")
    return file_path.read_bytes()


def _build_settlement_report_context(
    cession_file: Any,
    contract: Any,
    cedent_name: str,
    settlement_row: dict[str, Any],
    reconciliation: dict[str, Any],
    generated_at: datetime,
) -> dict[str, Any]:
    uploaded = reconciliation.get("uploaded") or {}
    system = reconciliation.get("system") or {}
    settlement_id = str(settlement_row.get("settlement_id") or reconciliation.get("settlement_id") or "")
    period_label = str(reconciliation.get("calculation_period") or settlement_row.get("period_label") or "")
    period_end = _parse_date(reconciliation.get("period_end")) or _parse_date(settlement_row.get("period_end")) or generated_at.date()
    payment_due = _parse_date(settlement_row.get("payment_due_date")) or _parse_date(reconciliation.get("payment_date")) or period_end
    received_at = getattr(cession_file, "received_at", None)
    date_received = received_at.date() if isinstance(received_at, datetime) else generated_at.date()
    currency = str(reconciliation.get("currency") or settlement_row.get("currency") or getattr(contract, "currency", "GBP") or "GBP").upper()
    fixed_leg = _decimal(uploaded.get("fixed_leg"))
    floating_leg = _decimal(uploaded.get("floating_leg"))
    fee = _decimal(uploaded.get("fee"))
    interest = _decimal(uploaded.get("interest_prior_period"))
    net_amount = _decimal(uploaded.get("net_settlement_amount"))
    exchange_rate = Decimal("1.000000")
    premium = _money(fixed_leg + fee)
    claim = _money(floating_leg)
    usd_premium = _money(premium * exchange_rate) if currency == "USD" else Decimal("0.00")
    usd_claim = _money(claim * exchange_rate) if currency == "USD" else Decimal("0.00")
    usd_received = _money(net_amount * exchange_rate) if currency == "USD" else Decimal("0.00")
    source_code = "MLR" if currency == "USD" else "GLR"
    bank_account = "JP Morgan" if currency == "USD" else "BNY Mellon"
    effective_date = getattr(contract, "effective_date", None) or getattr(contract, "inception_date", None)

    return {
        "artifact_prefix": _safe_filename(f"{getattr(cession_file, 'file_id', 'cession')}_{settlement_id}"),
        "cession_file_id": getattr(cession_file, "file_id", None),
        "source_filename": getattr(cession_file, "filename", None),
        "settlement_id": settlement_id,
        "treaty_id": getattr(contract, "contract_id", settlement_row.get("contract_id")),
        "cedent": cedent_name,
        "case_name": getattr(contract, "contract_name", settlement_row.get("contract_name") or settlement_id),
        "period_label": period_label,
        "period_end": period_end,
        "payment_due": payment_due,
        "date_received": date_received,
        "payment_late": date_received > payment_due,
        "fy_ry_code": _fy_ry_code(effective_date, period_end),
        "fixed_leg": _money(fixed_leg),
        "floating_leg": _money(floating_leg),
        "fee": _money(fee),
        "interest": _money(interest),
        "gbp_premium": premium,
        "gbp_claim": claim,
        "gbp_amount_received": _money(net_amount),
        "usd_premium": usd_premium,
        "usd_claim": usd_claim,
        "usd_received": usd_received,
        "exchange_rate": exchange_rate,
        "amount_due_matches": _money(net_amount) == _money(floating_leg - fixed_leg + fee + interest),
        "source_code": source_code,
        "bank_account": bank_account,
        "currency_code": "USD" if currency == "USD" else "GBP",
        "exchange_method": "As of Date" if currency == "USD" else "Current Date",
        "exchange_date": date_received if currency == "USD" else None,
        "reconciliation_decision": reconciliation.get("decision"),
        "mismatch_count": len(reconciliation.get("mismatches") or []),
        "generated_at": generated_at,
        "system_net": _money(system.get("net_settlement_amount")),
    }


def _write_csv_artifact(
    context: dict[str, Any],
    *,
    artifact_type: str,
    display_name: str,
    columns: list[str],
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    filename = f"{context['artifact_prefix']}_{artifact_type}.csv"
    file_path = SETTLEMENT_REPORT_REPOSITORY_DIR / filename
    with file_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: _csv_value(row.get(column, "")) for column in columns})

    generated_at = context["generated_at"]
    artifact_id = f"{context['cession_file_id']}-{artifact_type}".lower().replace("_", "-")
    relative_path = file_path.relative_to(SETTLEMENT_REPORT_REPOSITORY_DIR.parent.parent)
    return {
        "artifact_id": artifact_id,
        "settlement_id": context["settlement_id"],
        "cession_file_id": context["cession_file_id"],
        "contract_id": context["treaty_id"],
        "cedent": context["cedent"],
        "period": context["period_label"],
        "report_type": display_name,
        "filename": filename,
        "format": "csv",
        "path": relative_path.as_posix(),
        "generated_at": generated_at.isoformat().replace("+00:00", "Z"),
        "source_filename": context["source_filename"],
        "reconciliation_decision": context["reconciliation_decision"],
        "mismatch_count": context["mismatch_count"],
        "roles_with_access": SETTLEMENT_REPORT_ROLES,
    }


def _cash_tracker_row(context: dict[str, Any]) -> dict[str, Any]:
    comments = (
        f"Generated from {context['cession_file_id']} ({context['source_filename']}); "
        f"IRiS decision={context['reconciliation_decision']}; mismatches={context['mismatch_count']}."
    )
    return {
        "Treaty ID": context["treaty_id"],
        "Cedant": context["cedent"],
        "Case Name": context["case_name"],
        "Accounting Period End Date": context["period_end"],
        "Payment Due Date": context["payment_due"],
        "Date Received": context["date_received"],
        "Quarter": context["period_label"],
        "Payment Late": context["payment_late"],
        "FY/RY Code": context["fy_ry_code"],
        "Fixed Leg (GBP)": context["fixed_leg"],
        "Floating Leg (GBP)": context["floating_leg"],
        "Fee (GBP)": context["fee"],
        "Interest (If applicable)": context["interest"],
        "GBP Premium": context["gbp_premium"],
        "GBP Claim": context["gbp_claim"],
        "GBP Amount Received": context["gbp_amount_received"],
        "USD Premium": context["usd_premium"],
        "USD Claim": context["usd_claim"],
        "USD Received": context["usd_received"],
        "Exchange Rate": context["exchange_rate"],
        "Amount Received = Amount Due": context["amount_due_matches"],
        "PeopleSoft Journal ID": "",
        "GRDR Source Code": context["source_code"],
        "Bank Account": context["bank_account"],
        "Comments": comments,
    }


def _grdr_load_rows(context: dict[str, Any]) -> list[dict[str, Any]]:
    premium_amount = context["gbp_premium"]
    claim_amount = context["gbp_claim"]
    base = {
        "Treaty ID": context["treaty_id"],
        "Legal Entity Code": "LR",
        "Coverage Type Code": "BASE",
        "Product Line Code": "GD200005",
        "Subsegment": "",
        "Closed Block Sub Segment": "",
        "Closed Block Ind": "N",
        "Contract Participation Code": "NA",
        "Pension Indicator": "NA",
        "Reinsurance Distribution": "NA",
        "Experience Number": "",
        "Months Settled Count": "",
        "Paid to Date": "",
        "Original Bill Date": context["period_end"],
        "Currency Code": context["currency_code"],
        "Exchange Method": context["exchange_method"],
        "Exchange Date": context["exchange_date"] or "",
        "Exchange Rate": "",
        "CHARTFIELD3": "",
        "Contract Number": "",
        "Contract Sub Number": "",
        "Contract Suffix": "",
        "Intercompany Accounting": "",
        "Cash Legal Entity": "",
        "Cash Accounting Number": "",
        "Sub product code2": "",
        "Inforce Count": "",
        "Funds Withheld": Decimal("0.00"),
        "Misc Interest Exp": Decimal("0.00"),
        "Expense Allowance": Decimal("0.00"),
        "Commission": Decimal("0.00"),
        "Modco Adjust": Decimal("0.00"),
        "Experience Refund": Decimal("0.00"),
        "Premium Tax": Decimal("0.00"),
        "Claim Interest": max(context["interest"], Decimal("0.00")),
        "Misc Interest Income": abs(min(context["interest"], Decimal("0.00"))),
        "Erdr Unpaid Claims": Decimal("0.00"),
        "Premium Reversal": Decimal("0.00"),
    }
    premium_key = f"{context['treaty_id']} {context['period_label']} Premium"
    benefits_key = f"{context['treaty_id']} {context['period_label']} Benefits"
    return [
        {
            **base,
            "Renewal Code": context["fy_ry_code"],
            "Open Item Key": premium_key,
            "Description": premium_key,
            "Premium": premium_amount,
            "Paid Claim": "",
            "Net Due": premium_amount,
        },
        {
            **base,
            "Renewal Code": "NA",
            "Open Item Key": benefits_key,
            "Description": benefits_key,
            "Premium": "",
            "Paid Claim": claim_amount,
            "Net Due": -claim_amount,
        },
    ]


def _read_registry() -> list[dict[str, Any]]:
    if not SETTLEMENT_REPORT_REGISTRY_FILE.exists():
        return []
    with SETTLEMENT_REPORT_REGISTRY_FILE.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return deepcopy(payload) if isinstance(payload, list) else []


def _upsert_artifacts(artifacts: list[dict[str, Any]]) -> None:
    registry = _read_registry()
    by_id = {str(item.get("artifact_id")): item for item in registry if isinstance(item, dict)}
    for artifact in artifacts:
        by_id[str(artifact["artifact_id"])] = artifact
    updated = sorted(by_id.values(), key=lambda item: str(item.get("generated_at") or ""), reverse=True)
    SETTLEMENT_REPORT_REGISTRY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with SETTLEMENT_REPORT_REGISTRY_FILE.open("w", encoding="utf-8") as handle:
        json.dump(updated, handle, indent=2)


def _fy_ry_code(effective_date: date | None, accounting_period_end: date) -> str:
    if effective_date is None:
        return "RY"
    first_anniversary = effective_date + timedelta(days=365)
    return "FY" if accounting_period_end < first_anniversary else "RY"


def _parse_date(value: Any) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _decimal(value: Any) -> Decimal:
    try:
        decimal_value = value if isinstance(value, Decimal) else Decimal(str(value or "0"))
    except (InvalidOperation, ValueError):
        decimal_value = Decimal("0")
    return _money(decimal_value)


def _money(value: Any) -> Decimal:
    try:
        decimal_value = value if isinstance(value, Decimal) else Decimal(str(value or "0"))
    except (InvalidOperation, ValueError):
        decimal_value = Decimal("0")
    return decimal_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _csv_value(value: Any) -> str:
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    return str(value or "")


def _safe_filename(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())
    return normalized.strip("_") or "settlement_report"
