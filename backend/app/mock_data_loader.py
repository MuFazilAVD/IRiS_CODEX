from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


MOCK_DATA_DIR = Path(__file__).resolve().parent / "mock_data"


@lru_cache(maxsize=32)
def load_mock_data(filename: str) -> Any:
    file_path = MOCK_DATA_DIR / filename
    with file_path.open("r", encoding="utf-8") as file:
        return json.load(file)

