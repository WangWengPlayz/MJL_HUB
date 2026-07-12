"""Shared FastAPI dependencies: current admin session + CSRF verification."""
from __future__ import annotations

from typing import Optional

from fastapi import Header, HTTPException, Request, status

from app.auth import read_session_token
from app.config import SESSION_COOKIE_NAME


def get_current_admin(request: Request) -> Optional[dict]:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    return read_session_token(token)


def require_admin(request: Request) -> dict:
    session = get_current_admin(request)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return session


def require_csrf(request: Request, session: dict, x_csrf_token: Optional[str] = Header(default=None)) -> None:
    expected = session.get("csrf")
    if not expected or not x_csrf_token or x_csrf_token != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or missing CSRF token")
