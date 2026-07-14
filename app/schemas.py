"""Serialization helpers turning ScriptEntry objects into JSON-ready dicts."""
from __future__ import annotations

from datetime import datetime, timezone

from app.config import PUBLIC_BASE_URL
from app.info_store import get_info
from app.scripts_index import ScriptEntry


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")


def base_url(request=None) -> str:
    if PUBLIC_BASE_URL:
        return PUBLIC_BASE_URL.rstrip("/")
    if request is not None:
        return str(request.base_url).rstrip("/")
    return ""


def loader_snippet(name: str, filename: str, request=None) -> str:
    url = f"{base_url(request)}/script/{filename}"
    return f'loadstring(game:HttpGet("{url}"))()'


def sub_script_to_dict(entry, folder: str, request=None) -> dict:
    root = base_url(request)
    return {
        "label": entry.label,
        "order": entry.order,
        "filename": entry.filename,
        "size_bytes": entry.size,
        "checksum": entry.checksum,
        "lines": entry.lines,
        "downloads": entry.downloads,
        "raw_url": f"{root}/script/{entry.filename}",
        "loader": loader_snippet(folder, entry.filename, request),
    }


def script_to_dict(entry: ScriptEntry, request=None) -> dict:
    root = base_url(request)
    info = get_info(entry.name, fallback_updated_at=entry.updated_at)
    return {
        "name": entry.name,
        "filename": entry.filename,
        "size_bytes": entry.size,
        "checksum": entry.checksum,
        "lines": entry.lines,
        "tags": entry.tags,
        "created_at": _iso(entry.created_at),
        "updated_at": _iso(entry.updated_at),
        "views": entry.views,
        "downloads": entry.downloads,
        "copies": entry.copies,
        "raw_url": f"{root}/script/{entry.filename}",
        "api_url": f"{root}/api/script/{entry.name}",
        "loader": loader_snippet(entry.name, entry.filename, request),
        "title": info["title"],
        "description": info["description"],
        "version": info["version"],
        "creator": info["creator"],
        "credits": info["credits"],
        "last_updated": info["lastUpdated"],
        "is_group": entry.is_group,
        "folder": entry.folder,
        "sub_scripts": [sub_script_to_dict(s, entry.name, request) for s in entry.sub_scripts],
        "sub_count": len(entry.sub_scripts),
    }
