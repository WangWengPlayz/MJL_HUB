"""Admin dashboard API: auth, upload/delete/rename/replace/edit, users, logs."""
from __future__ import annotations

import shutil
import time
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse

from app.activity_log import log_activity, log_security, read_activity, read_security
from app.auth import add_user, change_password, create_session_token, delete_user, list_users, verify_credentials
from app.config import MAX_UPLOAD_BYTES, SCRIPTS_DIR, SESSION_COOKIE_NAME, SESSION_MAX_AGE
from app.deps import require_admin, require_csrf
from app.schemas import script_to_dict
from app.scripts_index import ScriptIndex, index, is_valid_filename, safe_script_path
from app.security import limiter

router = APIRouter(prefix="/admin/api")


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, response: JSONResponse, username: str = Form(...), password: str = Form(...)):
    if not verify_credentials(username, password):
        log_security("failed_login", detail=username, ip=_client_ip(request))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_session_token(username)
    from app.auth import read_session_token

    session = read_session_token(token)
    resp = JSONResponse({"ok": True, "username": username, "csrf": session["csrf"]})
    resp.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=True,
    )
    log_activity("login", actor=username, ip=_client_ip(request))
    return resp


@router.post("/logout")
def logout(request: Request, session: dict = Depends(require_admin)):
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(SESSION_COOKIE_NAME)
    log_activity("logout", actor=session.get("u", "?"), ip=_client_ip(request))
    return resp


@router.get("/me")
def me(session: dict = Depends(require_admin)):
    return {"username": session.get("u"), "csrf": session.get("csrf")}


def _guarded(request: Request, session: dict):
    require_csrf(request, session, request.headers.get("x-csrf-token"))


@router.post("/upload")
async def upload(request: Request, file: UploadFile = File(...), session: dict = Depends(require_admin)):
    _guarded(request, session)
    filename = file.filename or ""
    if not is_valid_filename(filename):
        raise HTTPException(status_code=400, detail="Invalid filename. Must be a plain name.js file.")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large")
    path = SCRIPTS_DIR / filename
    path.write_bytes(data)
    index.refresh_file(filename)
    log_activity("upload", actor=session.get("u", "?"), detail=filename, ip=_client_ip(request))
    entry = index.get(path.stem)
    return {"ok": True, "script": script_to_dict(entry, request) if entry else None}


@router.post("/bulk-upload")
async def bulk_upload(request: Request, files: list[UploadFile] = File(...), session: dict = Depends(require_admin)):
    _guarded(request, session)
    results = []
    for file in files:
        filename = file.filename or ""
        if not is_valid_filename(filename):
            results.append({"filename": filename, "ok": False, "error": "invalid filename"})
            continue
        data = await file.read()
        if len(data) > MAX_UPLOAD_BYTES:
            results.append({"filename": filename, "ok": False, "error": "too large"})
            continue
        (SCRIPTS_DIR / filename).write_bytes(data)
        index.refresh_file(filename)
        results.append({"filename": filename, "ok": True})
    log_activity("bulk_upload", actor=session.get("u", "?"), detail=f"{len(results)} files", ip=_client_ip(request))
    return {"results": results}


@router.delete("/script/{filename}")
def delete_script(request: Request, filename: str, session: dict = Depends(require_admin)):
    _guarded(request, session)
    path = safe_script_path(filename)
    if path is None:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")
    path.unlink()
    index.refresh_file(filename)
    log_activity("delete", actor=session.get("u", "?"), detail=filename, ip=_client_ip(request))
    return {"ok": True}


@router.post("/bulk-delete")
def bulk_delete(request: Request, filenames: list[str], session: dict = Depends(require_admin)):
    _guarded(request, session)
    results = []
    for filename in filenames:
        path = safe_script_path(filename)
        if path is None or not path.exists():
            results.append({"filename": filename, "ok": False})
            continue
        path.unlink()
        index.refresh_file(filename)
        results.append({"filename": filename, "ok": True})
    log_activity("bulk_delete", actor=session.get("u", "?"), detail=f"{len(results)} files", ip=_client_ip(request))
    return {"results": results}


@router.post("/rename")
def rename_script(
    request: Request,
    old_filename: str = Form(...),
    new_filename: str = Form(...),
    session: dict = Depends(require_admin),
):
    _guarded(request, session)
    old_path = safe_script_path(old_filename)
    if old_path is None or not old_path.exists():
        raise HTTPException(status_code=404, detail="Source script not found")
    if not is_valid_filename(new_filename):
        raise HTTPException(status_code=400, detail="Invalid new filename")
    new_path = SCRIPTS_DIR / new_filename
    if new_path.exists():
        raise HTTPException(status_code=409, detail="A script with that name already exists")
    old_path.rename(new_path)
    index.refresh_file(old_filename)
    index.refresh_file(new_filename)
    log_activity("rename", actor=session.get("u", "?"), detail=f"{old_filename} -> {new_filename}", ip=_client_ip(request))
    entry = index.get(new_path.stem)
    return {"ok": True, "script": script_to_dict(entry, request) if entry else None}


@router.post("/replace")
async def replace_script(request: Request, filename: str = Form(...), file: UploadFile = File(...), session: dict = Depends(require_admin)):
    _guarded(request, session)
    path = safe_script_path(filename)
    if path is None:
        raise HTTPException(status_code=400, detail="Invalid filename")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large")
    path.write_bytes(data)
    index.refresh_file(filename)
    log_activity("replace", actor=session.get("u", "?"), detail=filename, ip=_client_ip(request))
    entry = index.get(path.stem)
    return {"ok": True, "script": script_to_dict(entry, request) if entry else None}


@router.post("/edit")
def edit_source(request: Request, filename: str = Form(...), content: str = Form(...), session: dict = Depends(require_admin)):
    _guarded(request, session)
    path = safe_script_path(filename)
    if path is None:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if len(content.encode("utf-8")) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Content too large")
    path.write_text(content, encoding="utf-8")
    index.refresh_file(filename)
    log_activity("edit", actor=session.get("u", "?"), detail=filename, ip=_client_ip(request))
    entry = index.get(path.stem)
    return {"ok": True, "script": script_to_dict(entry, request) if entry else None}


@router.get("/source/{filename}")
def get_source(filename: str, session: dict = Depends(require_admin)):
    path = safe_script_path(filename)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Not found")
    return {"filename": filename, "content": path.read_text(encoding="utf-8", errors="replace")}


@router.get("/stats")
def admin_stats(session: dict = Depends(require_admin)):
    total, used, free = shutil.disk_usage(SCRIPTS_DIR)
    return {
        "total_scripts": index.count(),
        "total_bytes": index.total_bytes(),
        "disk_total": total,
        "disk_used": used,
        "disk_free": free,
        "last_scan": index.last_scan,
        "uptime_seconds": round(time.time() - index.started_at),
    }


@router.get("/logs/activity")
def logs_activity(limit: int = 200, session: dict = Depends(require_admin)):
    return {"entries": read_activity(limit)}


@router.get("/logs/security")
def logs_security(limit: int = 200, session: dict = Depends(require_admin)):
    return {"entries": read_security(limit)}


@router.get("/users")
def get_users(session: dict = Depends(require_admin)):
    return {"users": list_users()}


@router.post("/users")
def create_user(request: Request, username: str = Form(...), password: str = Form(...), session: dict = Depends(require_admin)):
    _guarded(request, session)
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not add_user(username, password):
        raise HTTPException(status_code=409, detail="Username already exists")
    log_activity("user_created", actor=session.get("u", "?"), detail=username, ip=_client_ip(request))
    return {"ok": True}


@router.delete("/users/{username}")
def remove_user(request: Request, username: str, session: dict = Depends(require_admin)):
    _guarded(request, session)
    if not delete_user(username):
        raise HTTPException(status_code=400, detail="Cannot delete the last remaining admin account")
    log_activity("user_deleted", actor=session.get("u", "?"), detail=username, ip=_client_ip(request))
    return {"ok": True}


@router.post("/change-password")
def update_password(request: Request, new_password: str = Form(...), session: dict = Depends(require_admin)):
    _guarded(request, session)
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    change_password(session.get("u", ""), new_password)
    log_activity("password_changed", actor=session.get("u", "?"), ip=_client_ip(request))
    return {"ok": True}
