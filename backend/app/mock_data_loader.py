from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any


MOCK_DATA_DIR = Path(__file__).resolve().parent / "mock_data"
_mock_data_cache: dict[str, tuple[int, Any]] = {}
_mock_data_lock = Lock()


def load_mock_data(filename: str) -> Any:
    file_path = MOCK_DATA_DIR / filename
    mtime_ns = file_path.stat().st_mtime_ns

    with _mock_data_lock:
        cached = _mock_data_cache.get(filename)
        if cached and cached[0] == mtime_ns:
            return cached[1]

        # Accept both standard UTF-8 JSON and UTF-8 files saved with a BOM.
        with file_path.open("r", encoding="utf-8-sig") as file:
            payload = json.load(file)

        _mock_data_cache[filename] = (mtime_ns, payload)
        return payload
