from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from config import load_backend_env


load_backend_env()


BASE_DIR = Path(__file__).resolve().parent.parent
APP_DIR = BASE_DIR / "app"


def _parse_origin_list(value: str) -> list[str]:
    return [origin.strip() for origin in value.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "IRiS"
    version: str = "1.0.0"
    api_v1_prefix: str = "/api/v1"
    environment: str = os.getenv("ENVIRONMENT", "development")
    jwt_secret: str = os.getenv("JWT_SECRET", "super-secret-key")
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "")
    frontend_origins_raw: str = os.getenv("FRONTEND_ORIGINS", "")
    database_url: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(BASE_DIR / 'iris.db').as_posix()}",
    )

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def frontend_origins(self) -> list[str]:
        if self.frontend_origins_raw:
            return _parse_origin_list(self.frontend_origins_raw)

        if self.frontend_origin:
            return _parse_origin_list(self.frontend_origin)

        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    @property
    def frontend_origin_regex(self) -> str | None:
        if self.frontend_origins_raw or self.frontend_origin:
            return None

        # Allow local Vite dev servers even when the port shifts to 5174+.
        return r"^http://(localhost|127\.0\.0\.1):\d+$"


settings = Settings()
