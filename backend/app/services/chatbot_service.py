from __future__ import annotations

import json
import logging
import re
from typing import Any, TypeVar

from pydantic import BaseModel

from config import OPENAI_MODEL, get_openai_client, get_openai_client_error
from app.errors import IrisAPIError
from app.repositories.chatbot_repository import ChatbotRepository
from app.schemas.chatbot import ChatbotLLMPlan, ChatbotMessageResponse, ChatbotSQLRepair
from app.services.chatbot_sql_tool import ChatbotSQLExecution, ChatbotSQLTool


logger = logging.getLogger(__name__)

JSON_OBJECT_PATTERN = re.compile(r"\{.*\}", re.DOTALL)
MAX_PLANNED_QUERIES = 3
SQL_ROW_LIMIT = 200
PII_REQUEST_RESPONSE = "I can't help with PII. I do not have access to PII."
IRRELEVANT_REQUEST_RESPONSE = (
    "I can't help with irrelevant questions. "
    "I can only help with IRiS platform workflows, navigation, and live operational data."
)
ANSWER_FORMAT_GUIDANCE = (
    "Format the answer as clean Markdown for a compact chat drawer. "
    "Lead with the answer immediately. "
    "Use short paragraphs for simple answers. "
    "Use flat bullet points only when they improve clarity for multiple facts, actions, or records. "
    "If you use labels, keep them short and bold. "
    "Do not use nested bullets, long preambles, or filler. "
    "Keep most answers to one short paragraph or up to four bullets."
)
SETTLEMENT_PIPELINE_SQL_GUIDANCE = (
    "For settlement questions about cession file processing or the settlement pipeline, do not rely on the "
    "settlements table alone. Pipeline reconciliation values live in cession_file_records.mapped_data JSON for "
    "Settlement files, joined through cession_files.id = cession_file_records.cession_file_id. Use SQLite "
    "json_extract on mapped_data for fields such as $.calculation_period, $.fee, "
    "$.settlement_reconciliation.uploaded.fee, $.settlement_reconciliation.system.fee, "
    "$.settlement_reconciliation.uploaded.net_settlement_amount, and "
    "$.settlement_reconciliation.system.net_settlement_amount. Settlement fee is a deduction in the net formula, "
    "so positive fee values reduce the net settlement amount. For multi-row Settlement files, aggregate uploaded "
    "fixed leg, floating leg, fee, interest, and net across all incoming rows once per file. Do not sum "
    "$.settlement_reconciliation.system.* across cession_file_records rows because those values are row-level "
    "diagnostics and can repeat the file-level system expectation. For the authoritative file-level IRiS system "
    "total after processing, join settlements on settlements.cession_file_id = cession_files.id and use the "
    "single linked settlements row, or compute one total from aggregated uploaded components."
)
IRIS_DOMAIN_KEYWORDS = {
    "iris",
    "dashboard",
    "worklist",
    "underwriting",
    "cedant",
    "cedants",
    "cedent",
    "cedents",
    "contract",
    "contracts",
    "population",
    "member",
    "members",
    "policy",
    "policies",
    "claim",
    "claims",
    "cession",
    "settlement",
    "settlements",
    "reconciliation",
    "calculation",
    "calculations",
    "pipeline",
    "pipelines",
    "screening",
    "sanction",
    "sanctions",
    "compliance",
    "audit",
    "reports",
    "report",
    "admin",
    "user",
    "users",
    "role",
    "roles",
    "library",
    "reference",
    "workflow",
    "workflows",
    "approval",
    "approvals",
    "exception",
    "exceptions",
    "navigate",
    "navigation",
}
IRIS_HELP_PHRASES = {
    "help",
    "what can you do",
    "how can you help",
    "what do you do",
    "your capabilities",
    "what can iris do",
}
PII_KEYWORDS = {
    "pii",
    "personal data",
    "personal information",
    "personally identifiable information",
    "ssn",
    "social security",
    "date of birth",
    "dob",
    "birth date",
    "passport",
    "driver license",
    "driving license",
    "national id",
    "tax id",
    "tin",
    "bank account",
    "account number",
    "routing number",
    "iban",
    "swift",
    "sort code",
    "credit card",
    "debit card",
    "cvv",
    "card number",
    "phone number",
    "mobile number",
    "email address",
    "home address",
    "mailing address",
    "residential address",
    "beneficiary",
    "beneficiaries",
    "member details",
    "employee id",
}
PII_PATTERNS = (
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    re.compile(r"\b(?:ssn|dob|tin|iban|cvv)\b"),
)

ROLE_NAVIGATION_PREFIXES = {
    "admin": ["/dashboard", "/worklist", "/reports", "/admin"],
    "underwriter": ["/dashboard", "/worklist", "/underwriting", "/reports"],
    "claims_ops": ["/dashboard", "/worklist", "/claims", "/operations", "/reports"],
    "compliance": ["/dashboard", "/worklist", "/compliance", "/reports"],
    "super_admin": ["/"],
}

ROLE_ROUTE_CATALOG = {
    "admin": [
        {"path": "/dashboard", "label": "Admin dashboard"},
        {"path": "/worklist", "label": "Shared worklist"},
        {"path": "/reports", "label": "Reports workspace"},
        {"path": "/admin/users", "label": "Users & roles"},
        {"path": "/admin/library", "label": "Reference library"},
    ],
    "underwriter": [
        {"path": "/dashboard", "label": "Underwriting dashboard"},
        {"path": "/worklist", "label": "Shared worklist"},
        {"path": "/underwriting/cedants", "label": "Cedants register"},
        {"path": "/underwriting/contracts", "label": "Contracts register"},
        {"path": "/underwriting/population", "label": "Population register"},
        {"path": "/reports", "label": "Reports workspace"},
    ],
    "claims_ops": [
        {"path": "/dashboard", "label": "Claims dashboard"},
        {"path": "/worklist", "label": "Shared worklist"},
        {"path": "/claims/cession-files", "label": "Cession files queue"},
        {"path": "/claims/settlements", "label": "Settlement workbench"},
        {"path": "/claims/calculation-engine", "label": "Calculation engine"},
        {"path": "/operations", "label": "Operations pipeline"},
        {"path": "/reports", "label": "Reports workspace"},
    ],
    "compliance": [
        {"path": "/dashboard", "label": "Compliance dashboard"},
        {"path": "/worklist", "label": "Shared worklist"},
        {"path": "/compliance/sanctions", "label": "Sanctions workspace"},
        {"path": "/compliance/audit", "label": "Audit & traceability"},
        {"path": "/reports", "label": "Reports workspace"},
    ],
    "super_admin": [
        {"path": "/dashboard", "label": "Dashboard"},
        {"path": "/worklist", "label": "Shared worklist"},
        {"path": "/underwriting/cedants", "label": "Cedants register"},
        {"path": "/underwriting/contracts", "label": "Contracts register"},
        {"path": "/underwriting/population", "label": "Population register"},
        {"path": "/claims/cession-files", "label": "Cession files queue"},
        {"path": "/claims/settlements", "label": "Settlement workbench"},
        {"path": "/claims/calculation-engine", "label": "Calculation engine"},
        {"path": "/operations", "label": "Operations pipeline"},
        {"path": "/compliance/sanctions", "label": "Sanctions workspace"},
        {"path": "/compliance/audit", "label": "Audit & traceability"},
        {"path": "/reports", "label": "Reports workspace"},
        {"path": "/admin/users", "label": "Users & roles"},
        {"path": "/admin/library", "label": "Reference library"},
    ],
}

ResponseModel = TypeVar("ResponseModel", bound=BaseModel)


class ChatbotService:
    def __init__(self, repository: ChatbotRepository) -> None:
        self.repository = repository
        self.sql_tool = ChatbotSQLTool(repository)

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
        guardrail_response = self._guardrail_response(message=message, current_page=current_page)
        if guardrail_response is not None:
            return ChatbotMessageResponse(
                response=guardrail_response,
                navigation_action=None,
                sql_query_used=None,
                sources=[],
            ).model_dump()

        client = get_openai_client()
        if client is None:
            logger.error(
                "OpenAI client is not configured for live chatbot responses reason=%s",
                get_openai_client_error(),
            )
            return ChatbotMessageResponse(
                response="IRiS Assist needs the configured OpenAI client before it can answer live data questions.",
                navigation_action=None,
                sql_query_used=None,
                sources=[],
            ).model_dump()

        conversation_history = payload.get("conversation_history", [])
        table_catalog = self.sql_tool.describe_catalog()
        logger.info("Planning chatbot response with live LLM")
        logger.debug("Chatbot runtime table catalog tables=%s", len(table_catalog))
        plan = self._plan_chatbot_response(
            client=client,
            user_message=message,
            current_page=current_page,
            request_role=request_role,
            conversation_history=conversation_history,
            table_catalog=table_catalog,
        )
        if not plan.requires_sql and plan.answer_strategy in {PII_REQUEST_RESPONSE, IRRELEVANT_REQUEST_RESPONSE}:
            logger.info("Returning chatbot planner guardrail response without SQL execution")
            logger.debug("Planner guardrail intent=%s answer_strategy=%s", plan.intent, plan.answer_strategy)
            return ChatbotMessageResponse(
                response=plan.answer_strategy,
                navigation_action=None,
                sql_query_used=None,
                sources=[],
            ).model_dump()
        executions = self._run_planned_queries(
            client=client,
            plan=plan,
            user_message=message,
            current_page=current_page,
            request_role=request_role,
            conversation_history=conversation_history,
            table_catalog=table_catalog,
        )
        navigation_action = self._allowed_navigation_action(plan.navigation_action, request_role)
        response_text = self._generate_answer(
            client=client,
            plan=plan,
            executions=executions,
            user_message=message,
            current_page=current_page,
            request_role=request_role,
            conversation_history=conversation_history,
            table_catalog=table_catalog,
            navigation_action=navigation_action,
        )
        if plan.navigation_action and navigation_action is None:
            response_text = f"{response_text} Navigation is limited for the current role, so I kept this as a read-only answer."

        return ChatbotMessageResponse(
            response=response_text,
            navigation_action=navigation_action,
            sql_query_used=self._combined_sql(executions),
            sources=self._response_sources(executions),
        ).model_dump()

    def _plan_chatbot_response(
        self,
        *,
        client: Any,
        user_message: str,
        current_page: str,
        request_role: str,
        conversation_history: list[dict[str, Any]],
        table_catalog: list[dict[str, Any]],
    ) -> ChatbotLLMPlan:
        response = client.responses.create(
            model=OPENAI_MODEL,
            instructions=(
                "You are the IRiS Assist query planner for an internal reinsurance platform. "
                "You have a read-only SQL tool over the runtime database tables listed in the input. "
                "Refuse irrelevant or general-world questions outside the IRiS platform domain. "
                "Never provide or retrieve PII, personal data, or member-level identifying details. "
                "Use SQL for any live-data question about counts, statuses, records, comparisons, recent activity, worklists, contracts, cedents, cession files, reports, audit events, screening cache data, or reference data. "
                "Never invent values. Only use the runtime tables listed in the input. "
                f"If the user asks for PII or personal data, set requires_sql to false, set navigation_action to null, and set answer_strategy to exactly '{PII_REQUEST_RESPONSE}'. "
                f"If the user asks an irrelevant or off-topic question, set requires_sql to false, set navigation_action to null, and set answer_strategy to exactly '{IRRELEVANT_REQUEST_RESPONSE}'. "
                "If the user asks for data that is not available in the runtime tables, set requires_sql to false and let the answering model explain that the live database does not expose it. "
                "If the user is asking for navigation only, set requires_sql to false and supply a navigation_action when appropriate. "
                f"{SETTLEMENT_PIPELINE_SQL_GUIDANCE} "
                "Return JSON only with this shape: "
                '{"intent": "string", "requires_sql": true, "sql_queries": [{"purpose": "string", "sql": "string"}], "navigation_action": "/path-or-null", "answer_strategy": "string"}. '
                "Queries must be a single read-only SELECT or WITH statement. Prefer joins over multiple queries. "
                "Use LIMIT when returning raw rows. Maximum 3 queries."
            ),
            input=json.dumps(
                {
                    "role": request_role,
                    "current_page": current_page,
                    "user_message": user_message,
                    "conversation_history": self._conversation_excerpt(conversation_history),
                    "allowed_routes": ROLE_ROUTE_CATALOG.get(request_role, ROLE_ROUTE_CATALOG["admin"]),
                    "runtime_tables": table_catalog,
                },
                indent=2,
                default=str,
            ),
        )
        plan = self._parse_json_response(
            response.output_text or "",
            ChatbotLLMPlan,
            "IRiS Assist could not create a valid query plan for that request.",
        )
        if plan.requires_sql and not plan.sql_queries:
            logger.error("Chatbot planner returned requires_sql without any queries")
            raise IrisAPIError(502, "Chatbot planning failed", "IRiS Assist did not return a SQL query for a live data request")
        logger.info("Chatbot response plan created")
        logger.debug(
            "Chatbot plan intent=%s requires_sql=%s query_count=%s navigation_action=%s",
            plan.intent,
            plan.requires_sql,
            len(plan.sql_queries),
            plan.navigation_action,
        )
        return plan

    def _run_planned_queries(
        self,
        *,
        client: Any,
        plan: ChatbotLLMPlan,
        user_message: str,
        current_page: str,
        request_role: str,
        conversation_history: list[dict[str, Any]],
        table_catalog: list[dict[str, Any]],
    ) -> list[ChatbotSQLExecution]:
        executions: list[ChatbotSQLExecution] = []
        for query_plan in plan.sql_queries[:MAX_PLANNED_QUERIES]:
            failure_details: str | None = None
            try:
                executions.append(
                    self.sql_tool.execute(
                        purpose=query_plan.purpose,
                        query=query_plan.sql,
                        max_rows=SQL_ROW_LIMIT,
                    )
                )
                continue
            except Exception as exc:  # pragma: no cover - runtime path depends on LLM output
                failure_details = str(exc)
                logger.error("Chatbot SQL execution failed error=%s", exc)
                logger.debug(
                    "Chatbot SQL failure purpose=%s query=%s",
                    query_plan.purpose,
                    query_plan.sql,
                )

            repaired_query = self._repair_sql_query(
                client=client,
                user_message=user_message,
                current_page=current_page,
                request_role=request_role,
                conversation_history=conversation_history,
                table_catalog=table_catalog,
                failed_query=query_plan.sql,
                failure_details=failure_details or "Unknown SQL execution failure",
            )
            try:
                executions.append(
                    self.sql_tool.execute(
                        purpose=query_plan.purpose,
                        query=repaired_query,
                        max_rows=SQL_ROW_LIMIT,
                    )
                )
            except Exception as repair_exc:  # pragma: no cover - runtime path depends on LLM output
                logger.error("Chatbot SQL repair execution failed error=%s", repair_exc)
                raise IrisAPIError(
                    502,
                    "Chatbot query failed",
                    "IRiS Assist could not execute a valid read-only SQL query for that request",
                ) from repair_exc
        return executions

    def _repair_sql_query(
        self,
        *,
        client: Any,
        user_message: str,
        current_page: str,
        request_role: str,
        conversation_history: list[dict[str, Any]],
        table_catalog: list[dict[str, Any]],
        failed_query: str,
        failure_details: str,
    ) -> str:
        logger.info("Repairing chatbot SQL query with LLM")
        response = client.responses.create(
            model=OPENAI_MODEL,
            instructions=(
                "You are repairing a read-only SQL query for IRiS Assist. "
                f"{SETTLEMENT_PIPELINE_SQL_GUIDANCE} "
                "Return JSON only with shape {\"sql\": \"...\"}. "
                "Preserve the original intent, use only the runtime tables and columns from the input, and return one SELECT or WITH statement only."
            ),
            input=json.dumps(
                {
                    "role": request_role,
                    "current_page": current_page,
                    "user_message": user_message,
                    "conversation_history": self._conversation_excerpt(conversation_history),
                    "runtime_tables": table_catalog,
                    "failed_query": failed_query,
                    "failure_details": failure_details,
                },
                indent=2,
                default=str,
            ),
        )
        repaired = self._parse_json_response(
            response.output_text or "",
            ChatbotSQLRepair,
            "IRiS Assist could not repair the generated SQL query.",
        )
        logger.debug("Chatbot repaired SQL query=%s", repaired.sql)
        return repaired.sql

    def _generate_answer(
        self,
        *,
        client: Any,
        plan: ChatbotLLMPlan,
        executions: list[ChatbotSQLExecution],
        user_message: str,
        current_page: str,
        request_role: str,
        conversation_history: list[dict[str, Any]],
        table_catalog: list[dict[str, Any]],
        navigation_action: str | None,
    ) -> str:
        logger.info("Generating final chatbot answer from live context")
        logger.debug(
            "Chatbot answer context query_count=%s navigation_action=%s",
            len(executions),
            navigation_action,
        )
        try:
            response = client.responses.create(
                model=OPENAI_MODEL,
                instructions=(
                    "You are IRiS Assist inside an internal reinsurance operations platform. "
                    "Answer only from the provided live SQL results, allowed navigation routes, and runtime table catalog. "
                    "Do not answer irrelevant or general-world questions outside the IRiS platform domain. "
                    "Do not provide, infer, summarize, or reveal PII, personal data, or member-level identifying details. "
                    "Do not invent values, IDs, records, or routes. "
                    f"If the user asks for PII or personal data, reply exactly: {PII_REQUEST_RESPONSE} "
                    f"If the user asks an irrelevant or off-topic question, reply exactly: {IRRELEVANT_REQUEST_RESPONSE} "
                    "If the SQL results are empty, say you could not find matching live records. "
                    "If the database does not expose the requested data, say so plainly. "
                    "Keep the tone clear, professional, and businesslike. "
                    f"{ANSWER_FORMAT_GUIDANCE}"
                ),
                input=json.dumps(
                    {
                        "role": request_role,
                        "current_page": current_page,
                        "user_message": user_message,
                        "conversation_history": self._conversation_excerpt(conversation_history),
                        "plan": plan.model_dump(),
                        "navigation_action": navigation_action,
                        "allowed_routes": ROLE_ROUTE_CATALOG.get(request_role, ROLE_ROUTE_CATALOG["admin"]),
                        "runtime_tables": table_catalog,
                        "sql_results": [self._execution_payload(item) for item in executions],
                    },
                    indent=2,
                    default=str,
                ),
            )
            output_text = (response.output_text or "").strip()
            if output_text:
                return output_text
        except Exception as exc:  # pragma: no cover - runtime path depends on LLM output
            logger.error("Chatbot final answer generation failed error=%s", exc)

        logger.error("Falling back to generic chatbot answer rendering")
        return self._generic_answer_from_results(plan, executions, navigation_action)

    def _generic_answer_from_results(
        self,
        plan: ChatbotLLMPlan,
        executions: list[ChatbotSQLExecution],
        navigation_action: str | None,
    ) -> str:
        if not executions:
            response = plan.answer_strategy or "I can help with live data questions, but this request did not need a database query."
            if navigation_action:
                return f"{response} I also have a matching page ready if you want to open it."
            return response

        first_result = executions[0]
        if first_result.row_count == 0:
            return "I could not find matching live records in the current database for that request."

        lead_row = json.dumps(first_result.rows[0], ensure_ascii=True)
        suffix = " Results were truncated to the first 200 rows." if first_result.truncated else ""
        return f"I found {first_result.row_count} row(s) for '{first_result.purpose}'. First row: {lead_row}.{suffix}"

    def _execution_payload(self, execution: ChatbotSQLExecution) -> dict[str, Any]:
        return {
            "purpose": execution.purpose,
            "query": execution.query,
            "columns": execution.columns,
            "row_count": execution.row_count,
            "truncated": execution.truncated,
            "tables": execution.tables,
            "rows": execution.rows,
        }

    def _conversation_excerpt(self, conversation_history: list[dict[str, Any]]) -> list[dict[str, str]]:
        excerpt: list[dict[str, str]] = []
        for item in conversation_history[-6:]:
            role = str(item.get("role") or "").strip().lower()
            content = str(item.get("content") or "").strip()
            if role not in {"user", "assistant"} or not content:
                continue
            excerpt.append({"role": role, "content": content[:800]})
        return excerpt

    def _guardrail_response(self, *, message: str, current_page: str) -> str | None:
        normalized_message = self._normalize_guardrail_text(message)
        if self._requests_pii(normalized_message):
            logger.info("Chatbot guardrail blocked PII request")
            logger.debug("PII guardrail message=%s current_page=%s", message, current_page)
            return PII_REQUEST_RESPONSE
        if not self._is_relevant_to_iris(normalized_message, current_page):
            logger.info("Chatbot guardrail blocked irrelevant request")
            logger.debug("Irrelevant guardrail message=%s current_page=%s", message, current_page)
            return IRRELEVANT_REQUEST_RESPONSE
        return None

    def _normalize_guardrail_text(self, text: str) -> str:
        normalized = re.sub(r"[^a-z0-9/]+", " ", text.lower()).strip()
        return re.sub(r"\s+", " ", normalized)

    def _requests_pii(self, normalized_message: str) -> bool:
        if any(keyword in normalized_message for keyword in PII_KEYWORDS):
            return True
        return any(pattern.search(normalized_message) for pattern in PII_PATTERNS)

    def _is_relevant_to_iris(self, normalized_message: str, current_page: str) -> bool:
        if not normalized_message:
            return False
        if normalized_message in IRIS_HELP_PHRASES:
            return True
        if "current page" in normalized_message or "this page" in normalized_message:
            return True
        if current_page and current_page != "/" and " here " in f" {normalized_message} ":
            return True
        if current_page and current_page != "/" and current_page.lower() in normalized_message:
            return True
        if any(f"/{keyword}" in normalized_message for keyword in ("dashboard", "worklist", "underwriting", "claims", "operations", "compliance", "reports", "admin")):
            return True
        return any(keyword in normalized_message for keyword in IRIS_DOMAIN_KEYWORDS)

    def _allowed_navigation_action(self, requested_path: str | None, request_role: str) -> str | None:
        if not requested_path:
            return None
        if self._is_path_allowed_for_role(requested_path, request_role):
            return requested_path
        logger.info("Chatbot navigation request blocked by role guard")
        logger.debug("Blocked chatbot navigation role=%s path=%s", request_role, requested_path)
        return None

    def _response_sources(self, executions: list[ChatbotSQLExecution]) -> list[str]:
        ordered_sources: list[str] = []
        for execution in executions:
            for table_name in execution.tables:
                source = f"{table_name} table"
                if source in ordered_sources:
                    continue
                ordered_sources.append(source)
        return ordered_sources

    def _combined_sql(self, executions: list[ChatbotSQLExecution]) -> str | None:
        if not executions:
            return None
        return "\n\n".join(execution.query for execution in executions)

    def _is_path_allowed_for_role(self, path: str, role: str) -> bool:
        prefixes = ROLE_NAVIGATION_PREFIXES.get(role, ["/dashboard", "/worklist"])
        return any(path.startswith(prefix) for prefix in prefixes)

    def _parse_json_response(
        self,
        output_text: str,
        model_type: type[ResponseModel],
        failure_message: str,
    ) -> ResponseModel:
        candidate = output_text.strip()
        json_match = JSON_OBJECT_PATTERN.search(candidate)
        if json_match is not None:
            candidate = json_match.group(0)
        try:
            payload = json.loads(candidate)
            return model_type.model_validate(payload)
        except Exception as exc:  # pragma: no cover - runtime path depends on LLM output
            logger.error("Chatbot JSON parsing failed error=%s raw_output=%s", exc, output_text)
            raise IrisAPIError(502, "Chatbot response invalid", failure_message) from exc
