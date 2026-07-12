"""Central configuration for MJL HUB."""
from __future__ import annotations

import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Vercel's serverless filesystem is read-only except /tmp, and /tmp is wiped
# between cold starts/deployments. When running there we transparently
# mirror the repo's bundled /script (and data/logs) into /tmp so the app
# still boots and serves scripts, but admin uploads/edits will NOT persist
# across cold starts or new deployments -- only Render/a VPS/always-on host
# gives you the fully persistent, always-live-writable /script directory
# described in the spec.
ON_VERCEL = bool(os.environ.get("VERCEL"))

if ON_VERCEL:
    import shutil as _shutil

    _runtime_root = Path("/tmp/mjlhub")
    SCRIPTS_DIR = _runtime_root / "script"
    DATA_DIR = _runtime_root / "data"
    LOGS_DIR = _runtime_root / "logs"
    if not SCRIPTS_DIR.exists():
        _shutil.copytree(BASE_DIR / "script", SCRIPTS_DIR, dirs_exist_ok=True)
else:
    SCRIPTS_DIR = BASE_DIR / "script"
    DATA_DIR = BASE_DIR / "data"
    LOGS_DIR = BASE_DIR / "logs"

SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

USERS_FILE = DATA_DIR / "users.json"
ACTIVITY_LOG_FILE = LOGS_DIR / "activity.log"
SECURITY_LOG_FILE = LOGS_DIR / "security.log"

SITE_NAME = "MJL HUB"

# Session signing secret. Falls back to a random ephemeral secret so the app
# never fails to boot, but sessions will not survive a restart unless
# SESSION_SECRET is set.
SESSION_SECRET = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)

# Bootstrap admin credentials (only used to seed data/users.json on first run).
BOOTSTRAP_ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
BOOTSTRAP_ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

SESSION_COOKIE_NAME = "mjlhub_session"
SESSION_MAX_AGE = 12 * 60 * 60  # 12 hours

ALLOWED_EXTENSION = ".js"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB per script file

# Public base URL used to build loader / raw links. Prefer an explicit env
# var in production; falls back to the Replit dev domain for local preview.
PUBLIC_BASE_URL = (
    os.environ.get("PUBLIC_BASE_URL")
    or (f"https://{os.environ['REPLIT_DEV_DOMAIN']}" if os.environ.get("REPLIT_DEV_DOMAIN") else "")
)

IS_PRODUCTION = os.environ.get("REPLIT_DEPLOYMENT") == "1"
