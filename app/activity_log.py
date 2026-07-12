"""Append-only JSON-lines activity/security logging."""
from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any, Optional

from app.config import ACTIVITY_LOG_FILE, SECURITY_LOG_FILE

_lock = threading.Lock()


def _append(path: Path, entry: dict[str, Any]) -> None:
    entry.setdefault("ts", time.time())
    with _lock:
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def log_activity(action: str, actor: str = "system", detail: Optional[str] = None, ip: Optional[str] = None) -> None:
    _append(ACTIVITY_LOG_FILE, {"action": action, "actor": actor, "detail": detail, "ip": ip})


def log_security(event: str, detail: Optional[str] = None, ip: Optional[str] = None, path: Optional[str] = None) -> None:
    _append(SECURITY_LOG_FILE, {"event": event, "detail": detail, "ip": ip, "path": path})


def _tail(path: Path, limit: int) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        lines = f.readlines()[-limit:]
    out = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    out.reverse()
    return out


def read_activity(limit: int = 200) -> list[dict[str, Any]]:
    return _tail(ACTIVITY_LOG_FILE, limit)


def read_security(limit: int = 200) -> list[dict[str, Any]]:
    return _tail(SECURITY_LOG_FILE, limit)
