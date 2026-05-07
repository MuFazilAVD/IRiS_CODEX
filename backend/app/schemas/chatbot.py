from __future__ import annotations

from pydantic import BaseModel, Field


class ChatbotConversationEntry(BaseModel):
    role: str
    content: str


class ChatbotMessageRequest(BaseModel):
    message: str
    conversation_history: list[ChatbotConversationEntry] = Field(default_factory=list)
    user_role: str
    current_page: str


class ChatbotSQLPlanQuery(BaseModel):
    purpose: str
    sql: str


class ChatbotLLMPlan(BaseModel):
    intent: str
    requires_sql: bool = False
    sql_queries: list[ChatbotSQLPlanQuery] = Field(default_factory=list)
    navigation_action: str | None = None
    answer_strategy: str = ""


class ChatbotSQLRepair(BaseModel):
    sql: str


class ChatbotMessageResponse(BaseModel):
    response: str
    navigation_action: str | None = None
    sql_query_used: str | None = None
    sources: list[str] = Field(default_factory=list)
