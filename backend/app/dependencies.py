from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, Header, Request
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import IrisAPIError
from app.models.user import User


def get_current_user(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User:
    if not authorization.startswith("Bearer "):
        raise IrisAPIError(401, "Unauthorized", "Missing or invalid bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
    except JWTError as exc:
        raise IrisAPIError(401, "Unauthorized", "Token could not be decoded") from exc

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise IrisAPIError(401, "Unauthorized", "User not found or inactive")
    return user


def require_roles(roles: list[str]) -> Callable[[User], User]:
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles and current_user.role != "super_admin":
            raise IrisAPIError(403, "Forbidden", "Role is not permitted for this resource")
        return current_user

    return dependency


def get_request_role(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> str:
    header_role = request.headers.get("x-active-role")
    if current_user.role == "super_admin" and header_role:
        return header_role
    if current_user.role == "super_admin":
        return "admin"
    return current_user.role
