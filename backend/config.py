from __future__ import annotations

import os
from pathlib import Path
from typing import Any


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

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - runtime dependency fallback
    OpenAI = None  # type: ignore[assignment]


def _build_openai_client() -> Any | None:
    if OpenAI is None or not OPENAI_API_KEY:
        return None
    return OpenAI(api_key=OPENAI_API_KEY)


openai_client = _build_openai_client()
