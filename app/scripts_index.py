"""Filesystem-backed script index.

Watches SCRIPTS_DIR with watchdog and keeps an in-memory index synchronized
with the directory contents. The filesystem is the single source of truth --
there is no database. Any add/delete/rename/edit under SCRIPTS_DIR is picked
up automatically (via the watcher) and also refreshed synchronously whenever
the admin API mutates a file directly, so there is never a stale read.
"""
from __future__ import annotations

import hashlib
import re
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from app.config import SCRIPTS_DIR

FILENAME_RE = re.compile(r"^[A-Za-z0-9_+.\-]{1,100}\.js$")
TAG_COMMENT_RE = re.compile(r"@tags?:\s*(.+)", re.IGNORECASE)


@dataclass
class ScriptEntry:
    filename: str
    name: str
    size: int
    checksum: str
    created_at: float
    updated_at: float
    lines: int
    tags: list[str] = field(default_factory=list)
    views: int = 0
    downloads: int = 0
    copies: int = 0


def is_valid_filename(filename: str) -> bool:
    """Reject anything that isn't a bare, safe `name.js` filename.

    No path separators, no traversal sequences, no hidden/system files --
    this is the core defense against directory traversal / path injection.
    """
    if not filename or "/" in filename or "\\" in filename:
        return False
    if filename in (".", ".."):
        return False
    return bool(FILENAME_RE.match(filename))


def safe_script_path(filename: str) -> Optional[Path]:
    """Resolve filename to a path guaranteed to live inside SCRIPTS_DIR."""
    if not is_valid_filename(filename):
        return None
    candidate = (SCRIPTS_DIR / filename).resolve()
    try:
        candidate.relative_to(SCRIPTS_DIR.resolve())
    except ValueError:
        return None
    return candidate


def _extract_tags(text: str) -> list[str]:
    for line in text.splitlines()[:10]:
        m = TAG_COMMENT_RE.search(line)
        if m:
            return [t.strip() for t in m.group(1).split(",") if t.strip()]
    return []


class ScriptIndex:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._entries: dict[str, ScriptEntry] = {}
        self._created_at: dict[str, float] = {}
        self._counters: dict[str, dict[str, int]] = {}
        self.last_scan: float = 0.0
        self.started_at = time.time()
        self._observer: Optional[Observer] = None

    # -- read API ---------------------------------------------------------
    def all(self) -> list[ScriptEntry]:
        with self._lock:
            return sorted(self._entries.values(), key=lambda e: e.name.lower())

    def get(self, name: str) -> Optional[ScriptEntry]:
        with self._lock:
            return self._entries.get(name)

    def count(self) -> int:
        with self._lock:
            return len(self._entries)

    def total_bytes(self) -> int:
        with self._lock:
            return sum(e.size for e in self._entries.values())

    def bump(self, name: str, field_name: str) -> None:
        with self._lock:
            entry = self._entries.get(name)
            if entry is None:
                return
            setattr(entry, field_name, getattr(entry, field_name) + 1)

    # -- sync logic ---------------------------------------------------------
    def _load_one(self, path: Path) -> Optional[ScriptEntry]:
        try:
            stat = path.stat()
            data = path.read_bytes()
        except (FileNotFoundError, OSError):
            return None
        checksum = hashlib.sha256(data).hexdigest()[:12]
        try:
            text = data.decode("utf-8", errors="replace")
        except Exception:
            text = ""
        name = path.stem
        prior = self._entries.get(name)
        created_at = self._created_at.get(name, stat.st_mtime)
        counters = self._counters.get(name, {"views": 0, "downloads": 0, "copies": 0})
        if prior is not None:
            counters = {"views": prior.views, "downloads": prior.downloads, "copies": prior.copies}
        return ScriptEntry(
            filename=path.name,
            name=name,
            size=stat.st_size,
            checksum=checksum,
            created_at=created_at,
            updated_at=stat.st_mtime,
            lines=text.count("\n") + (1 if text and not text.endswith("\n") else 0),
            tags=_extract_tags(text),
            views=counters["views"],
            downloads=counters["downloads"],
            copies=counters["copies"],
        )

    def rescan(self) -> None:
        """Full resync against the filesystem. Cheap enough to call often,
        but the watcher normally makes this unnecessary except at startup."""
        with self._lock:
            current_files = {
                p.name for p in SCRIPTS_DIR.glob("*.js") if p.is_file() and is_valid_filename(p.name)
            }
            existing_names = set(self._entries.keys())
            # Remove entries whose file disappeared.
            for name in list(existing_names):
                entry = self._entries[name]
                if entry.filename not in current_files:
                    del self._entries[name]
                    self._created_at.pop(name, None)
                    self._counters.pop(name, None)
            # Add / refresh existing files.
            for filename in current_files:
                path = SCRIPTS_DIR / filename
                entry = self._load_one(path)
                if entry is None:
                    continue
                name = entry.name
                if name not in self._created_at:
                    self._created_at[name] = entry.created_at
                self._entries[name] = entry
                self._counters[name] = {
                    "views": entry.views,
                    "downloads": entry.downloads,
                    "copies": entry.copies,
                }
            self.last_scan = time.time()

    def refresh_file(self, filename: str) -> None:
        """Refresh (or remove) the index entry for a single filename."""
        with self._lock:
            path = SCRIPTS_DIR / filename
            name = Path(filename).stem
            if not path.exists():
                if name in self._entries:
                    del self._entries[name]
                self.last_scan = time.time()
                return
            entry = self._load_one(path)
            if entry is None:
                return
            if name not in self._created_at:
                self._created_at[name] = entry.created_at
            self._entries[name] = entry
            self.last_scan = time.time()

    # -- watcher --------------------------------------------------------
    def start_watcher(self) -> None:
        self.rescan()
        handler = _Handler(self)
        observer = Observer()
        observer.schedule(handler, str(SCRIPTS_DIR), recursive=False)
        observer.start()
        self._observer = observer

    def stop_watcher(self) -> None:
        if self._observer:
            self._observer.stop()
            self._observer.join(timeout=2)


class _Handler(FileSystemEventHandler):
    """Debounced watchdog handler: coalesces rapid-fire events per file."""

    DEBOUNCE_SECONDS = 0.4

    def __init__(self, index: ScriptIndex) -> None:
        self.index = index
        self._pending: dict[str, float] = {}
        self._timer_lock = threading.Lock()

    def _schedule(self, filename: str) -> None:
        if not filename.endswith(".js"):
            return
        with self._timer_lock:
            self._pending[filename] = time.time() + self.DEBOUNCE_SECONDS

        def worker(fn: str, fire_at: float) -> None:
            delay = fire_at - time.time()
            if delay > 0:
                time.sleep(delay)
            with self._timer_lock:
                if self._pending.get(fn) != fire_at:
                    return  # a newer event superseded this one
                del self._pending[fn]
            self.index.refresh_file(fn)

        threading.Thread(target=worker, args=(filename, self._pending[filename]), daemon=True).start()

    def on_created(self, event):
        if not event.is_directory:
            self._schedule(Path(event.src_path).name)

    def on_modified(self, event):
        if not event.is_directory:
            self._schedule(Path(event.src_path).name)

    def on_deleted(self, event):
        if not event.is_directory:
            self._schedule(Path(event.src_path).name)

    def on_moved(self, event):
        if not event.is_directory:
            self._schedule(Path(event.src_path).name)
            self._schedule(Path(event.dest_path).name)


index = ScriptIndex()
