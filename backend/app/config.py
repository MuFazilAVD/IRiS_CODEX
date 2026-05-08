from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from config import load_backend_env


load_backend_env()


BASE_DIR = Path(__file__).resolve().parent.parent
APP_DIR = BASE_DIR / "app"


@dataclass(frozen=True)
class Settings:
    app_name: str = "IRiS"
    version: str = "1.0.0"
    api_v1_prefix: str = os.getenv("API_V1_PREFIX", "/iris/api/v1")
    environment: str = os.getenv("ENVIRONMENT", "development")
    jwt_secret: str = os.getenv("JWT_SECRET", "super-secret-key")
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
    database_url: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(BASE_DIR / 'iris.db').as_posix()}",
    )

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


settings = Settings()
