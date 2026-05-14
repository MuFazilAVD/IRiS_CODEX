from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any


logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
ENV_FILES = (BASE_DIR / ".env", BASE_DIR.parent / ".env")


def load_backend_env() -> None:
    for env_file in ENV_FILES:
        if not env_file.exists():
            continue

        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), _strip_wrapping_quotes(value.strip()))


def _strip_wrapping_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


load_backend_env()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.2").strip() or "gpt-5.2"

_cached_openai_client: Any | None = None
_openai_client_error: str | None = None


def _build_openai_client() -> Any | None:
    global _openai_client_error
    if not OPENAI_API_KEY:
        _openai_client_error = "OPENAI_API_KEY is not configured"
        return None
    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover - runtime dependency fallback
        _openai_client_error = f"openai import failed: {exc}"
        logger.error("OpenAI client import failed error=%s", exc)
        return None
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
    except Exception as exc:  # pragma: no cover - runtime dependency fallback
        _openai_client_error = f"OpenAI client init failed: {exc}"
        logger.error("OpenAI client initialization failed error=%s", exc)
        return None
    _openai_client_error = None
    return client


def get_openai_client() -> Any | None:
    global _cached_openai_client
    if _cached_openai_client is not None:
        return _cached_openai_client
    _cached_openai_client = _build_openai_client()
    return _cached_openai_client


def get_openai_client_error() -> str | None:
    return _openai_client_error


openai_client = get_openai_client()
