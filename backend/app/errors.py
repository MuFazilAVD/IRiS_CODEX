from __future__ import annotations


class IrisAPIError(Exception):
    def __init__(self, status_code: int, error: str, details: str) -> None:
        self.status_code = status_code
        self.error = error
        self.details = details
        super().__init__(details)

