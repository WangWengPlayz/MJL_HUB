"""Admin authentication: signed session cookies + bcrypt password hashing.

Users are stored in a flat JSON file (data/users.json) since the project
deliberately avoids an external database -- the filesystem is the source of
truth for everything, including admin accounts. Passwords are always stored
as bcrypt hashes, never plaintext.
"""
from __future__ import annotations

import json
import secrets
import threading
import time
from pathlib import Path
from typing import Optional

import bcrypt
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import (
    BOOTSTRAP_ADMIN_PASSWORD,
    BOOTSTRAP_ADMIN_USERNAME,
    SESSION_MAX_AGE,
    SESSION_SECRET,
    USERS_FILE,
)

_serializer = URLSafeTimedSerializer(SESSION_SECRET, salt="mjlhub-session")


class _PasswordContext:
    """Thin wrapper around bcrypt, used directly to avoid passlib's flaky
    version-detection against modern bcrypt releases."""

    @staticmethod
    def hash(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("ascii")

    @staticmethod
    def verify(password: str, hashed: str) -> bool:
        try:
            return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("ascii"))
        except ValueError:
            return False


pwd_context = _PasswordContext()
_lock = threading.Lock()


def _load_users() -> dict:
    if not USERS_FILE.exists():
        return {"users": []}
    try:
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"users": []}


def _save_users(data: dict) -> None:
    with _lock:
        tmp = USERS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
        tmp.replace(USERS_FILE)


def ensure_bootstrap_admin() -> Optional[str]:
    """Create the first admin account if none exists yet.

    Returns a plaintext generated password if one had to be auto-generated,
    so it can be surfaced to the operator exactly once.
    """
    data = _load_users()
    if data.get("users"):
        return None
    password = BOOTSTRAP_ADMIN_PASSWORD or secrets.token_urlsafe(12)
    data["users"] = [
        {
            "username": BOOTSTRAP_ADMIN_USERNAME,
            "password_hash": pwd_context.hash(password),
            "created_at": time.time(),
        }
    ]
    _save_users(data)
    return None if BOOTSTRAP_ADMIN_PASSWORD else password


def list_users() -> list[dict]:
    return [{"username": u["username"], "created_at": u["created_at"]} for u in _load_users().get("users", [])]


def find_user(username: str) -> Optional[dict]:
    for u in _load_users().get("users", []):
        if u["username"].lower() == username.lower():
            return u
    return None


def verify_credentials(username: str, password: str) -> bool:
    user = find_user(username)
    if not user:
        # Still run a hash comparison to reduce username-enumeration timing signal.
        pwd_context.hash(password)
        return False
    return pwd_context.verify(password, user["password_hash"])


def add_user(username: str, password: str) -> bool:
    data = _load_users()
    if any(u["username"].lower() == username.lower() for u in data.get("users", [])):
        return False
    data.setdefault("users", []).append(
        {"username": username, "password_hash": pwd_context.hash(password), "created_at": time.time()}
    )
    _save_users(data)
    return True


def delete_user(username: str) -> bool:
    data = _load_users()
    users = data.get("users", [])
    if len(users) <= 1:
        return False
    new_users = [u for u in users if u["username"].lower() != username.lower()]
    if len(new_users) == len(users):
        return False
    data["users"] = new_users
    _save_users(data)
    return True


def change_password(username: str, new_password: str) -> bool:
    data = _load_users()
    for u in data.get("users", []):
        if u["username"].lower() == username.lower():
            u["password_hash"] = pwd_context.hash(new_password)
            _save_users(data)
            return True
    return False


# -- session cookie -------------------------------------------------------

def create_session_token(username: str) -> str:
    csrf_token = secrets.token_urlsafe(24)
    return _serializer.dumps({"u": username, "csrf": csrf_token})


def read_session_token(token: str) -> Optional[dict]:
    try:
        return _serializer.loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
