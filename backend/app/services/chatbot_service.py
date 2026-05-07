from __future__ import annotations

import json
import logging
import re
from typing import Any, TypeVar

from pydantic import BaseModel

from config import OPENAI_MODEL, openai_client
from app.errors import IrisAPIError
from app.repositories.chatbot_repository import ChatbotRepository
from app.schemas.chatbot import ChatbotLLMPlan, ChatbotMessageResponse, ChatbotSQLRepair
from app.services.chatbot_sql_tool import ChatbotSQLExecution, ChatbotSQLTool


logger = logging.getLogger(__name__)

JSON_OBJECT_PATTERN = re.compile(r"\{.*\}", re.DOTALL)
MAX_PLANNED_QUERIES = 3
SQL_ROW_LIMIT = 200

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

        if openai_client is None:
            logger.error("OpenAI client is not configured for live chatbot responses")
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
            user_message=message,
            current_page=current_page,
            request_role=request_role,
            conversation_history=conversation_history,
            table_catalog=table_catalog,
        )
        executions = self._run_planned_queries(
            plan=plan,
            user_message=message,
            current_page=current_page,
            request_role=request_role,
            conversation_history=conversation_history,
            table_catalog=table_catalog,
        )
        navigation_action = self._allowed_navigation_action(plan.navigation_action, request_role)
        response_text = self._generate_answer(
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
        user_message: str,
        current_page: str,
        request_role: str,
        conversation_history: list[dict[str, Any]],
        table_catalog: list[dict[str, Any]],
    ) -> ChatbotLLMPlan:
        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            instructions=(
                "You are the IRiS Assist query planner for an internal reinsurance platform. "
                "You have a read-only SQL tool over the runtime database tables listed in the input. "
                "Use SQL for any live-data question about counts, statuses, records, comparisons, recent activity, worklists, contracts, cedents, cession files, reports, audit events, screening cache data, or reference data. "
                "Never invent values. Only use the runtime tables listed in the input. "
                "If the user asks for data that is not available in the runtime tables, set requires_sql to false and let the answering model explain that the live database does not expose it. "
                "If the user is asking for navigation only, set requires_sql to false and supply a navigation_action when appropriate. "
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
        user_message: str,
        current_page: str,
        request_role: str,
        conversation_history: list[dict[str, Any]],
        table_catalog: list[dict[str, Any]],
        failed_query: str,
        failure_details: str,
    ) -> str:
        logger.info("Repairing chatbot SQL query with LLM")
        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            instructions=(
                "You are repairing a read-only SQL query for IRiS Assist. "
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
            response = openai_client.responses.create(
                model=OPENAI_MODEL,
                instructions=(
                    "You are IRiS Assist inside an internal reinsurance operations platform. "
                    "Answer only from the provided live SQL results, allowed navigation routes, and runtime table catalog. "
                    "Do not invent values, IDs, records, or routes. "
                    "If the SQL results are empty, say you could not find matching live records. "
                    "If the database does not expose the requested data, say so plainly. "
                    "Keep the answer concise and professional, usually 2 to 4 sentences."
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
