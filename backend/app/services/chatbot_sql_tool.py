from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

from app.errors import IrisAPIError
from app.repositories.chatbot_repository import ChatbotRepository


logger = logging.getLogger(__name__)

READ_ONLY_SQL_PATTERN = re.compile(r"^(select|with)\b", re.IGNORECASE)
FORBIDDEN_SQL_PATTERN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|vacuum|reindex|grant|revoke|merge|call|exec(?:ute)?|pragma)\b",
    re.IGNORECASE,
)
TABLE_REFERENCE_PATTERN = re.compile(r"\b(?:from|join)\s+([a-zA-Z_][\w.]*)", re.IGNORECASE)


@dataclass(frozen=True)
class ChatbotSQLExecution:
    purpose: str
    query: str
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    truncated: bool
    tables: list[str]


class ChatbotSQLTool:
    def __init__(self, repository: ChatbotRepository) -> None:
        self.repository = repository

    def describe_catalog(self) -> list[dict[str, Any]]:
        return self.repository.list_table_catalog()

    def execute(self, purpose: str, query: str, max_rows: int = 200) -> ChatbotSQLExecution:
        normalized_query = self._normalize_query(query)
        catalog = self.describe_catalog()
        known_tables = {entry["table_name"] for entry in catalog}
        logger.info("Executing chatbot SQL tool query")
        logger.debug("Chatbot SQL tool purpose=%s query=%s", purpose, normalized_query)
        payload = self.repository.execute_readonly_query(normalized_query, max_rows=max_rows)
        return ChatbotSQLExecution(
            purpose=purpose,
            query=normalized_query,
            columns=payload["columns"],
            rows=payload["rows"],
            row_count=int(payload["row_count"]),
            truncated=bool(payload["truncated"]),
            tables=self._extract_source_tables(normalized_query, known_tables),
        )

    def _normalize_query(self, query: str) -> str:
        cleaned = str(query or "").strip()
        if not cleaned:
            logger.error("Chatbot SQL tool rejected an empty query")
            raise IrisAPIError(400, "Invalid SQL query", "IRiS Assist generated an empty SQL query")

        statement_count = cleaned.count(";")
        if statement_count > 1 or (statement_count == 1 and not cleaned.endswith(";")):
            logger.error("Chatbot SQL tool rejected multiple SQL statements")
            raise IrisAPIError(400, "Invalid SQL query", "IRiS Assist may only execute one read-only SQL statement at a time")

        normalized = cleaned.rstrip(";").strip()
        if not READ_ONLY_SQL_PATTERN.match(normalized):
            logger.error("Chatbot SQL tool rejected a non-read-only statement")
            raise IrisAPIError(400, "Invalid SQL query", "IRiS Assist may only execute SELECT queries")

        if FORBIDDEN_SQL_PATTERN.search(normalized):
            logger.error("Chatbot SQL tool rejected a query containing a write keyword")
            raise IrisAPIError(400, "Invalid SQL query", "IRiS Assist may only execute read-only SQL")

        return normalized

    def _extract_source_tables(self, query: str, known_tables: set[str]) -> list[str]:
        ordered_tables: list[str] = []
        for match in TABLE_REFERENCE_PATTERN.finditer(query):
            table_name = match.group(1).split(".")[-1]
            if table_name not in known_tables or table_name in ordered_tables:
                continue
            ordered_tables.append(table_name)
        return ordered_tables
