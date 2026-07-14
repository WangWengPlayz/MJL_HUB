"""Public JSON API + raw file serving. Always reflects the live filesystem."""
from __future__ import annotations

import shutil
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, PlainTextResponse, Response

from app.activity_log import log_security
from app.config import SCRIPTS_DIR
from app.schemas import script_to_dict
from app.scripts_index import index, safe_script_path
from app.security import limiter

router = APIRouter()


@router.get("/api/scripts")
@limiter.limit("60/minute")
def api_scripts(request: Request, sort: str = "name"):
    entries = index.all()
    key_fns = {
        "name": lambda e: e.name.lower(),
        "updated": lambda e: -e.updated_at,
    }
    entries.sort(key=key_fns.get(sort, key_fns["name"]))
    return {"count": len(entries), "scripts": [script_to_dict(e, request) for e in entries]}


@router.get("/api/script/{name}")
@limiter.limit("60/minute")
def api_script(request: Request, name: str):
    entry = index.get(name)
    if entry is None:
        return JSONResponse({"error": "script not found"}, status_code=404)
    index.bump(name, "views")
    return script_to_dict(entry, request)


@router.get("/api/latest")
@limiter.limit("60/minute")
def api_latest(request: Request, limit: int = 10):
    entries = sorted(index.all(), key=lambda e: -e.updated_at)[: max(1, min(limit, 100))]
    return {"count": len(entries), "scripts": [script_to_dict(e, request) for e in entries]}


@router.get("/api/search")
@limiter.limit("30/minute")
def api_search(request: Request, q: str = ""):
    q_lower = q.strip().lower()
    if not q_lower:
        return {"count": 0, "scripts": []}
    matches = [
        e
        for e in index.all()
        if q_lower in e.name.lower() or q_lower in e.filename.lower() or any(q_lower in t.lower() for t in e.tags)
    ]
    return {"count": len(matches), "scripts": [script_to_dict(e, request) for e in matches]}


@router.get("/api/stats")
@limiter.limit("60/minute")
def api_stats(request: Request):
    total, used, free = shutil.disk_usage(SCRIPTS_DIR)
    entries = index.all()
    return {
        "total_scripts": len(entries),
        "total_bytes": index.total_bytes(),
        "total_views": sum(e.views for e in entries),
        "total_downloads": sum(e.downloads for e in entries),
        "last_scan": index.last_scan,
        "uptime_seconds": round(time.time() - index.started_at),
        "disk": {"total_bytes": total, "used_bytes": used, "free_bytes": free},
    }


@router.get("/api/status")
@limiter.limit("60/minute")
def api_status(request: Request):
    return {
        "status": "ok",
        "service": "MJL HUB",
        "scripts_indexed": index.count(),
        "last_scan": index.last_scan,
        "uptime_seconds": round(time.time() - index.started_at),
    }


@router.get("/script/{filepath:path}")
@limiter.limit("120/minute")
def raw_script(request: Request, filepath: str):
    """Serve the raw, untouched contents of a script file.

    Supports both flat scripts (`name.js`) and grouped scripts
    (`folder/main.js`, `folder/sp1.js`, ...). This is the only route that
    reads directly from SCRIPTS_DIR by path, so it is the most important
    path-traversal choke point in the app.
    """
    path = safe_script_path(filepath)
    if path is None:
        log_security("path_traversal_attempt", detail=filepath, ip=request.client.host if request.client else None, path=str(request.url))
        return PlainTextResponse("Invalid filename", status_code=400)
    if not path.exists() or not path.is_file():
        return PlainTextResponse("Not found", status_code=404)
    index.bump_download_for(filepath)
    # Serve inline as plain text (like any other API/raw output) -- no
    # Content-Disposition: attachment, so the browser displays it instead of
    # triggering a file download.
    content = path.read_text(encoding="utf-8", errors="replace")
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": "inline"},
    )
