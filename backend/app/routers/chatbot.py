from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_request_role
from app.models.user import User
from app.repositories.chatbot_repository import ChatbotRepository
from app.schemas.chatbot import ChatbotMessageRequest
from app.services.chatbot_service import ChatbotService


router = APIRouter(prefix="/chatbot", tags=["chatbot"])


def get_service(db: Session) -> ChatbotService:
    return ChatbotService(ChatbotRepository(db))


@router.post("/message")
def send_chatbot_message(
    payload: ChatbotMessageRequest,
    request_role: str = Depends(get_request_role),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return get_service(db).send_message(payload.model_dump(), request_role)
