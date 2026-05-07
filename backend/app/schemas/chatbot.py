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
