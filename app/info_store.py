"""Per-script metadata sidecar files: ./info/{name}.json

Optional, hand-authored companions to a script in /script/ -- title,
description, version, creator/credits, and lastUpdated. Follows the same
"filesystem is the source of truth, zero manual site edits" philosophy as
the scripts themselves: drop or edit info/{name}.json and it shows up on
the site automatically. If the file is missing (or a field is blank), the
site falls back to sensible defaults instead of erroring.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import INFO_DIR

_FIELDS = ("title", "description", "version", "creator", "credits", "lastUpdated")


def _safe_info_path(name: str) -> Optional[Path]:
    """Resolve name -> INFO_DIR/{name}.json, refusing any path traversal."""
    if not name or "/" in name or "\\" in name or name in (".", ".."):
        return None
    candidate = (INFO_DIR / f"{name}.json").resolve()
    try:
        candidate.relative_to(INFO_DIR.resolve())
    except ValueError:
        return None
    return candidate


def _iso_date(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def _defaults(name: str, fallback_updated_at: Optional[float]) -> dict:
    return {
        "title": name,
        "description": "",
        "version": "1.0.0",
        "creator": "",
        "credits": "",
        "lastUpdated": _iso_date(fallback_updated_at) if fallback_updated_at else "",
    }


def get_info(name: str, fallback_updated_at: Optional[float] = None) -> dict:
    """Read info/{name}.json if present; merge over defaults. Never raises --
    a missing file, malformed JSON, or blank fields just fall back."""
    defaults = _defaults(name, fallback_updated_at)
    path = _safe_info_path(name)
    if path is None or not path.exists():
        return defaults
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return defaults
    if not isinstance(data, dict):
        return defaults
    merged = defaults.copy()
    for key in _FIELDS:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            merged[key] = value.strip()
    return merged


def ensure_info_stub(name: str, updated_at: float) -> None:
    """The first time a script appears with no info/{name}.json yet, write a
    starter file (title = script name, exact current date) so there's
    something to edit in place. Never overwrites an existing file."""
    path = _safe_info_path(name)
    if path is None or path.exists():
        return
    stub = _defaults(name, updated_at)
    try:
        path.write_text(json.dumps(stub, indent=2) + "\n", encoding="utf-8")
    except OSError:
        pass
