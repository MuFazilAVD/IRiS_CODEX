from __future__ import annotations

import json
import logging
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

from app.errors import IrisAPIError
from app.mock_data_loader import load_mock_data
from app.repositories.chatbot_repository import ChatbotRepository


logger = logging.getLogger(__name__)

SETTLEMENT_OVERRIDES_FILE = Path(__file__).resolve().parent.parent / "mock_data" / "settlement_overrides.json"

ROLE_NAVIGATION_PREFIXES = {
    "admin": ["/dashboard", "/worklist"],
    "underwriter": ["/dashboard", "/worklist", "/underwriting"],
    "claims_ops": ["/dashboard", "/worklist", "/claims"],
    "compliance": ["/dashboard", "/worklist", "/compliance"],
    "super_admin": ["/"],
}


class ChatbotService:
    def __init__(self, repository: ChatbotRepository) -> None:
        self.repository = repository

    def send_message(self, payload: dict[str, Any], request_role: str) -> dict[str, Any]:
        logger.info("Processing chatbot message")
        logger.debug(
            "Chatbot payload role=%s current_page=%s history_items=%s message=%s",
            request_role,
            payload.get("current_page"),
            len(payload.get("conversation_history", [])),
            payload.get("message"),
        )
        message = str(payload.get("message") or "").strip()
        current_page = str(payload.get("current_page") or "/")
        if not message:
            logger.error("Chatbot request rejected because message content was empty")
            raise IrisAPIError(400, "Invalid message", "Chatbot message cannot be empty")

        normalized = message.lower()

        if contract_id := self._extract_contract_id(message):
            return self._respond_for_contract(contract_id, request_role)
        if settlement_id := self._extract_settlement_id(message):
            return self._respond_for_settlement_id(settlement_id, request_role)
        if self._mentions_screening_hits(normalized):
            return self._respond_for_screening_hits(request_role)
        if "audit" in normalized:
            return self._respond_for_audit_entries(request_role)
        if "worklist" in normalized or "fya" in normalized:
            return self._respond_for_worklist(request_role)
        if "settlement variance" in normalized or ("settlement" in normalized and "variance" in normalized):
            return self._respond_for_settlement_variance(message, request_role)
        if "active contract" in normalized:
            return self._respond_for_active_contract_count(message, request_role)
        if "cession" in normalized or ("file" in normalized and "claims" in normalized):
            return self._respond_for_recent_cession_files(request_role)
        if "dashboard" in normalized:
            return self._navigation_response(
                self._dashboard_for_role(request_role),
                request_role,
                f"I can take you to the {self._role_label(request_role)} dashboard.",
                sources=["role permissions"],
            )

        return self._fallback_response(request_role, current_page)

    def _respond_for_contract(self, contract_id: str, request_role: str) -> dict[str, Any]:
        contract = self.repository.get_contract(contract_id)
        if contract is None:
            logger.error("Chatbot contract lookup failed because contract_id=%s was not found", contract_id)
            raise IrisAPIError(404, "Invalid contract ID", "Contract not found in DB")

        cedent = self.repository.get_cedent(contract.cedent_id) if contract.cedent_id else None
        population_count = self.repository.count_current_population_for_contract(contract.contract_id)
        response = (
            f"{contract.contract_id} is {contract.contract_name} for {cedent.legal_entity_name if cedent else 'an unmapped cedent'}. "
            f"Status is {contract.status}, notional is {self._format_money(contract.notional_amount, contract.currency)}, "
            f"and the current register shows {population_count or contract.lives_count or 0:,} lives."
        )
        sql = f"SELECT * FROM contracts WHERE contract_id = '{contract.contract_id}'"
        return self._navigation_response(
            f"/underwriting/contracts/{contract.contract_id}",
            request_role,
            response,
            sql_query_used=sql,
            sources=["contracts table", "cedents table", "policy_register table"],
        )

    def _respond_for_settlement_id(self, settlement_id: str, request_role: str) -> dict[str, Any]:
        settlement = next((item for item in self._load_settlements() if item["settlement_id"] == settlement_id), None)
        if settlement is None:
            logger.error("Chatbot settlement lookup failed because settlement_id=%s was not found", settlement_id)
            raise IrisAPIError(404, "Invalid settlement ID", "Settlement not found in mock register")

        cedent = self.repository.get_cedent(settlement.get("cedent_id"))
        response = (
            f"{settlement['settlement_id']} for {cedent.legal_entity_name if cedent else 'an unmapped cedent'} "
            f"is {settlement.get('status', 'pending_approval')} with net {self._format_signed_money(settlement['net_amount'], settlement['currency'])}. "
            f"Due date is {settlement['payment_due_date']}."
        )
        return self._navigation_response(
            f"/claims/settlements",
            request_role,
            response,
            sql_query_used=None,
            sources=["settlements_seed.json", "settlement_overrides.json"],
        )

    def _respond_for_screening_hits(self, request_role: str) -> dict[str, Any]:
        hits = self._latest_screening_hits()
        if not hits:
            response = "There are no active screening hits in the current mock screening register."
        else:
            lead = hits[0]
            response = (
                f"The latest screening hit is {lead['cedent_name']} on {lead['source']} with {lead['matches']} match(es). "
                f"{len(hits)} cedant(s) currently show review or open-hit activity."
            )
        return self._navigation_response(
            "/compliance/sanctions",
            request_role,
            response,
            sources=["cedents table", "cedent_detail_overrides.json"],
        )

    def _respond_for_audit_entries(self, request_role: str) -> dict[str, Any]:
        events = self._recent_audit_entries()
        if not events:
            response = "No recent audit entries are available in the current mock audit register."
        else:
            lead = events[0]
            response = (
                f"Recent audit activity: {lead['timestamp']} · {lead['actor']} · {lead['action']}. "
                f"I can also show the sanctions workspace if you want to review the broader trail."
            )
        return self._navigation_response(
            "/compliance/sanctions",
            request_role,
            response,
            sources=["cedent_detail_overrides.json", "contract_detail_overrides.json", "settlement_overrides.json"],
        )

    def _respond_for_worklist(self, request_role: str) -> dict[str, Any]:
        items = self._worklist_items_for_role(request_role)
        if not items:
            response = f"There are no {self._role_label(request_role)} worklist items in the current register."
        else:
            lead = items[0]
            response = (
                f"You have {len(items)} visible {self._role_label(request_role).lower()} worklist item(s). "
                f"The top item is {lead['wl_id']}: {lead['title']}."
            )
        return self._navigation_response(
            "/worklist",
            request_role,
            response,
            sql_query_used="SELECT * FROM worklist_items WHERE assigned_role = :role",
            sources=self._worklist_sources_for_role(request_role),
        )

    def _respond_for_settlement_variance(self, message: str, request_role: str) -> dict[str, Any]:
        settlements = self._load_settlements()
        filtered = [item for item in settlements if item.get("period_label") == "Q1 2025"]
        contract_id = self._extract_contract_id(message)
        if contract_id:
            filtered = [item for item in filtered if item.get("contract_id") == contract_id]
        if not filtered:
            response = "I couldn't find a matching Q1 settlement variance in the current mock register."
        else:
            lead = max(filtered, key=lambda item: abs(float(item.get("net_amount") or 0)))
            cedent = self.repository.get_cedent(lead.get("cedent_id"))
            response = (
                f"The largest Q1 2025 settlement variance is {self._format_signed_money(lead['net_amount'], lead['currency'])} "
                f"for {cedent.legal_entity_name if cedent else lead['contract_id']} ({lead['contract_id']})."
            )
        return self._navigation_response(
            "/claims/settlements",
            request_role,
            response,
            sources=["settlements_seed.json", "settlement_overrides.json"],
        )

    def _respond_for_active_contract_count(self, message: str, request_role: str) -> dict[str, Any]:
        cedent = self._match_cedent_from_message(message)
        if cedent is None:
            return {
                "response": "Tell me the cedant name and I can count active contracts for that counterparty.",
                "navigation_action": None,
                "sql_query_used": None,
                "sources": ["cedents table"],
            }
        count = self.repository.count_active_contracts_for_cedent(cedent.cedent_id)
        response = f"{cedent.legal_entity_name} currently has {count} active contract(s) in the contracts register."
        return self._navigation_response(
            "/underwriting/contracts",
            request_role,
            response,
            sql_query_used=f"SELECT COUNT(*) FROM contracts WHERE cedent_id = '{cedent.cedent_id}' AND status = 'active'",
            sources=["contracts table", "cedents table"],
        )

    def _respond_for_recent_cession_files(self, request_role: str) -> dict[str, Any]:
        files = self.repository.list_recent_cession_files(limit=3)
        if not files:
            response = "There are no cession files in the current queue."
        else:
            response = (
                "Recent cession files: "
                + "; ".join(f"{item.file_id} ({item.file_type or 'Unclassified'}) at stage {item.stage}" for item in files)
                + "."
            )
        return self._navigation_response(
            "/claims/cession-files",
            request_role,
            response,
            sql_query_used="SELECT * FROM cession_files ORDER BY received_at DESC LIMIT 3",
            sources=["cession_files table"],
        )

    def _fallback_response(self, request_role: str, current_page: str) -> dict[str, Any]:
        response = (
            f"I can help with contracts, settlements, cession files, worklist items, screening hits, or navigation from {current_page}. "
            "Try asking for a contract ID, the latest screening hits, your worklist, or the Q1 settlement variance."
        )
        return {
            "response": response,
            "navigation_action": None,
            "sql_query_used": None,
            "sources": ["contracts table", "cedents table", "worklist register", "settlements_seed.json"],
        }

    def _navigation_response(
        self,
        requested_path: str,
        request_role: str,
        response: str,
        sql_query_used: str | None = None,
        sources: list[str] | None = None,
    ) -> dict[str, Any]:
        allowed = self._is_path_allowed_for_role(requested_path, request_role)
        final_response = response
        navigation_action = requested_path if allowed else None
        if not allowed:
            final_response = f"{response} Navigation is limited for the current role, so I kept this as a read-only answer."
        return {
            "response": final_response,
            "navigation_action": navigation_action,
            "sql_query_used": sql_query_used,
            "sources": sources or [],
        }

    def _extract_contract_id(self, message: str) -> str | None:
        match = re.search(r"(LSC-\d{4}-\d{3})", message.upper())
        return match.group(1) if match else None

    def _extract_settlement_id(self, message: str) -> str | None:
        match = re.search(r"(SET-\d{4}-Q\d-\d{3})", message.upper())
        return match.group(1) if match else None

    def _mentions_screening_hits(self, normalized: str) -> bool:
        return "screening" in normalized or "ofac" in normalized or "fincen" in normalized or "hit" in normalized

    def _match_cedent_from_message(self, message: str) -> Any | None:
        normalized = message.lower()
        cedents = self.repository.list_all_cedents()
        return next((item for item in cedents if item.legal_entity_name.lower() in normalized), None) or next(
            (item for item in cedents if item.legal_entity_name.lower().split()[0] in normalized),
            None,
        )

    def _load_settlements(self) -> list[dict[str, Any]]:
        base = deepcopy(load_mock_data("settlements_seed.json"))
        overrides = self._read_settlement_override_store()
        for item in base:
            for key, value in overrides.get(item["settlement_id"], {}).items():
                item[key] = value
        return base

    def _read_settlement_override_store(self) -> dict[str, Any]:
        if not SETTLEMENT_OVERRIDES_FILE.exists():
            return {}
        with SETTLEMENT_OVERRIDES_FILE.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else {}

    def _latest_screening_hits(self) -> list[dict[str, Any]]:
        cedents = {item.cedent_id: item for item in self.repository.list_all_cedents()}
        overrides = load_mock_data("cedent_detail_overrides.json")
        hits: list[dict[str, Any]] = []
        for cedent_id, cedent in cedents.items():
            detail = overrides.get(cedent_id, {})
            screening = detail.get("sanction_screening", {})
            history = screening.get("history", [])
            matched_history = [item for item in history if item.get("matches", 0) > 0 or item.get("result") == "review"]
            latest = matched_history[0] if matched_history else (history[0] if history else None)
            open_hits = int(screening.get("open_hits", 0))
            needs_review = (cedent.screening_status or "").lower() in {"review", "pending"}
            if not needs_review and open_hits == 0 and not matched_history:
                continue
            hits.append(
                {
                    "cedent_id": cedent_id,
                    "cedent_name": cedent.legal_entity_name,
                    "source": latest.get("source", "OFAC") if latest else "Periodic Screening",
                    "matches": max(int(latest.get("matches", 0)) if latest else 0, open_hits, 1 if needs_review else 0),
                    "screening_date": (
                        latest.get("screening_date", "")
                        if latest
                        else screening.get("next_periodic_due", "")
                    ),
                }
            )
        hits.sort(key=lambda item: item["screening_date"], reverse=True)
        return hits

    def _recent_audit_entries(self) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []

        cedent_overrides = load_mock_data("cedent_detail_overrides.json")
        for cedent_id, detail in cedent_overrides.items():
            for event in detail.get("audit_approval", []):
                events.append(
                    {
                        "timestamp": event.get("timestamp", ""),
                        "actor": event.get("actor", "Unknown"),
                        "action": event.get("action", ""),
                        "detail": event.get("detail", ""),
                        "source": f"cedent:{cedent_id}",
                    }
                )

        contract_overrides = load_mock_data("contract_detail_overrides.json")
        for contract_id, detail in contract_overrides.items():
            audit_section = detail.get("audit_compliance", {})
            for event in audit_section.get("audit_trail", []):
                events.append(
                    {
                        "timestamp": event.get("timestamp", ""),
                        "actor": event.get("actor", "Unknown"),
                        "action": event.get("action", ""),
                        "detail": event.get("detail", ""),
                        "source": f"contract:{contract_id}",
                    }
                )

        settlement_overrides = self._read_settlement_override_store()
        for settlement_id, detail in settlement_overrides.items():
            for event in detail.get("audit_trail", []):
                events.append(
                    {
                        "timestamp": event.get("timestamp", ""),
                        "actor": event.get("actor", "Unknown"),
                        "action": event.get("action", ""),
                        "detail": event.get("detail", ""),
                        "source": f"settlement:{settlement_id}",
                    }
                )

        events.sort(key=lambda item: item["timestamp"], reverse=True)
        return events[:5]

    def _worklist_items_for_role(self, role: str) -> list[dict[str, Any]]:
        if role == "claims_ops":
            items = self.repository.list_worklist_items_for_role(role, limit=5)
            return [{"wl_id": item.wl_id, "title": item.title} for item in items]

        file_map = {
            "underwriter": "worklist_underwriter.json",
            "compliance": "worklist_compliance.json",
            "admin": "worklist_admin.json",
        }
        filename = file_map.get(role)
        if not filename:
            return []
        payload = load_mock_data(filename)
        rows = payload.get("items", []) if isinstance(payload, dict) else payload
        return [{"wl_id": item["wl_id"], "title": item["title"]} for item in rows[:5]]

    def _worklist_sources_for_role(self, role: str) -> list[str]:
        if role == "claims_ops":
            return ["worklist_items table"]
        return [f"backend/app/mock_data/worklist_{role}.json"]

    def _is_path_allowed_for_role(self, path: str, role: str) -> bool:
        prefixes = ROLE_NAVIGATION_PREFIXES.get(role, ["/dashboard", "/worklist"])
        return any(path.startswith(prefix) for prefix in prefixes)

    def _dashboard_for_role(self, role: str) -> str:
        return "/dashboard"

    def _role_label(self, role: str) -> str:
        return {
            "admin": "Admin",
            "underwriter": "Underwriting",
            "claims_ops": "Claims Ops",
            "compliance": "Compliance",
            "super_admin": "Super Admin",
        }.get(role, role.replace("_", " ").title())

    def _format_money(self, amount: Any, currency: str | None) -> str:
        numeric = float(amount or 0)
        return f"{currency or 'USD'} {numeric:,.0f}"

    def _format_signed_money(self, amount: Any, currency: str | None) -> str:
        numeric = float(amount or 0)
        return f"{'+' if numeric >= 0 else '-'}{currency or 'USD'} {abs(numeric):,.0f}"
