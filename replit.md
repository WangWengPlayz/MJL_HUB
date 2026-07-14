# MJL HUB

## Overview
MJL HUB is a fully automated script hosting platform. It watches the `/script/`
directory on the filesystem and keeps the entire website (homepage, search,
JSON API, script pages) in sync automatically — adding, deleting, renaming, or
editing a `.js` file under `/script/` takes effect within about a second, with
no restart and no manual database edits. The filesystem is the single source
of truth; there is no external database.

A script can be a single `name.js` file, or a **grouped** script: a folder
`script/{name}/main.js` plus any number of `sp1.js`, `sp2.js`, ... support
files. Grouped scripts show as one card/page (named after the folder) with
small "SP" pills for the support files instead of appearing as separate
top-level scripts. See `info/README.md` for the exact folder convention.

## Architecture
- **Backend**: Python 3.11 + FastAPI (`app/main.py`), served by Uvicorn.
- **File watcher**: `app/scripts_index.py` uses `watchdog` (recursive, one
  level deep) to observe `/script/` and maintains a thread-safe in-memory
  index (`ScriptIndex`). It detects both flat `name.js` files and grouped
  `folder/main.js` (+ `folder/spN.js`) scripts. Every mutating admin action
  also calls `index.refresh_file(...)`/`refresh_group(...)` directly so
  there's zero lag even before the watcher event fires.
- **Frontend**: server-rendered Jinja2 templates (`app/templates/`) + vanilla
  JS/CSS (`app/static/`). No frontend framework/build step.
- **Auth**: single-file JSON user store (`data/users.json`, bcrypt-hashed
  passwords) + signed session cookies (itsdangerous, keyed by `SESSION_SECRET`).
  CSRF token is embedded in the session and required via `X-CSRF-Token` header
  on all mutating `/admin/api/*` calls.
- **Security**: filename allowlist regex blocks path traversal in
  `app/scripts_index.py::is_valid_filename` / `safe_script_path`; security
  headers middleware (`app/security.py`); slowapi rate limiting (stricter on
  `/admin/api/login`); activity + security event logs in `logs/`.
- **Routers**: `app/routers/pages.py` (HTML pages), `app/routers/api.py`
  (public JSON API + raw file serving), `app/routers/admin.py` (protected
  admin dashboard API).

## Key endpoints
- `/` homepage, `/scripts/{name}` source viewer, `/login`, `/admin`
- `/script/{filename}` raw file passthrough
- `/api/scripts`, `/api/script/{name}`, `/api/latest`, `/api/search?q=`,
  `/api/stats`, `/api/status`
- `/admin/api/*` — upload, bulk-upload, delete, bulk-delete, rename, replace,
  edit, users, logs, change-password (all require an authenticated session +
  CSRF header)

## Running locally
The "Start application" workflow runs `python main.py`, which boots Uvicorn on
`0.0.0.0:5000`. On first boot, if `data/users.json` doesn't exist yet, an
`admin` account is created with either the `ADMIN_PASSWORD` secret (if set) or
a random generated password printed once to the console — check the workflow
log and log in at `/login`, then change the password from the Admin →
Account tab.

## User preferences
None recorded yet.
