from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from app.config import settings
from app.errors import IrisAPIError
from app.models.user import User
from app.repositories.auth_repository import AuthRepository
from app.schemas.auth import AuthResponse, RegisterRequest, UserResponse


logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


class AuthService:
    def __init__(self, repository: AuthRepository) -> None:
        self.repository = repository

    def verify_password(self, plain_password: str, password_hash: str) -> bool:
        return pwd_context.verify(plain_password, password_hash)

    def hash_password(self, plain_password: str) -> str:
        return pwd_context.hash(plain_password)

    def create_token(self, user: User) -> str:
        expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
        payload = {"sub": user.id, "role": user.role, "exp": expires}
        return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

    def build_auth_response(self, user: User) -> AuthResponse:
        logger.debug("Building auth response for user_id=%s role=%s", user.id, user.role)
        return AuthResponse(
            access_token=self.create_token(user),
            expires_in=settings.jwt_expire_minutes * 60,
            user=UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role,
                is_active=user.is_active,
            ),
        )

    def login(self, email: str, password: str) -> AuthResponse:
        logger.info("Authenticating user via password login")
        logger.debug("Login attempt for email=%s", email)
        user = self.repository.get_by_email(email)
        if user is None or not self.verify_password(password, user.password_hash):
            logger.error("Login failed for email=%s", email)
            raise IrisAPIError(401, "Invalid credentials", "Email or password is incorrect")

        user.last_login = datetime.utcnow()
        self.repository.update_user(user)
        return self.build_auth_response(user)

    def sso_login(self) -> AuthResponse:
        logger.info("Authenticating user via mock SSO flow")
        user = self.repository.get_first_super_admin()
        if user is None:
            logger.error("Mock SSO failed because no super admin user is seeded")
            raise IrisAPIError(500, "SSO unavailable", "No super admin user exists for SSO")
        return self.build_auth_response(user)

    def register(self, payload: RegisterRequest) -> UserResponse:
        logger.info("Creating new user account")
        logger.debug("Register request email=%s role=%s", payload.email, payload.role)
        existing_user = self.repository.get_by_email(payload.email)
        if existing_user:
            logger.error("User registration failed because email=%s already exists", payload.email)
            raise IrisAPIError(409, "User exists", "A user with this email already exists")

        user = User(
            username=payload.email.split("@")[0],
            email=payload.email,
            full_name=payload.full_name,
            role=payload.role,
            password_hash=self.hash_password(payload.password),
            is_active=True,
        )
        created = self.repository.create_user(user)
        return UserResponse(
            id=created.id,
            email=created.email,
            full_name=created.full_name,
            role=created.role,
            is_active=created.is_active,
        )
