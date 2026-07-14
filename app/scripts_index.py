"""Filesystem-backed script index.

Watches SCRIPTS_DIR with watchdog and keeps an in-memory index synchronized
with the directory contents. The filesystem is the single source of truth --
there is no database. Any add/delete/rename/edit under SCRIPTS_DIR is picked
up automatically (via the watcher) and also refreshed synchronously whenever
the admin API mutates a file directly, so there is never a stale read.

Two script shapes are supported, and both are fully filesystem-driven:

- Simple: `/script/name.js` -> one script named "name".
- Grouped: `/script/foldername/main.js` (+ optional `sp1.js`, `sp2.js`, ...)
  -> one script named "foldername" whose primary code is `main.js`, with any
  `spN.js` files alongside it listed as small "support scripts" that belong
  to the same card/page instead of appearing as their own top-level script.
  A folder with no `main.js` is ignored (not a valid script group).
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
from app.info_store import ensure_info_stub

FILENAME_RE = re.compile(r"^[A-Za-z0-9_+.\-]{1,100}\.js$")
# Grouped-script folder names are used as display names (e.g. "+1 Magic
# Evolution"), so they're allowed to contain spaces and common punctuation
# that a flat `name.js` filename can't -- just no path separators or leading/
# trailing dots that could enable traversal.
FOLDER_NAME_RE = re.compile(r"^[A-Za-z0-9_+][A-Za-z0-9 _+.,'()\[\]&#!-]{0,99}$")
MAIN_FILENAME = "main.js"
SP_RE = re.compile(r"^sp(\d+)\.js$", re.IGNORECASE)
TAG_COMMENT_RE = re.compile(r"@tags?:\s*(.+)", re.IGNORECASE)


@dataclass
class SubScriptEntry:
    """A support script (`spN.js`) living alongside a group's `main.js`."""

    filename: str  # relative to SCRIPTS_DIR, e.g. "foldername/sp1.js"
    label: str  # e.g. "SP1"
    order: int
    size: int
    checksum: str
    lines: int
    downloads: int = 0


@dataclass
class ScriptEntry:
    filename: str  # relative to SCRIPTS_DIR ("name.js" or "folder/main.js")
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
    is_group: bool = False
    folder: Optional[str] = None
    sub_scripts: list[SubScriptEntry] = field(default_factory=list)


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


def _split_relpath(relpath: str) -> Optional[tuple[Optional[str], str]]:
    """Split "name.js" -> (None, "name.js") or "folder/file.js" -> ("folder", "file.js").

    Returns None if the shape isn't one of those two (e.g. deeper nesting,
    absolute paths, backslashes, or traversal sequences).
    """
    if not relpath or "\\" in relpath or ".." in relpath:
        return None
    parts = relpath.split("/")
    if len(parts) == 1:
        return (None, parts[0])
    if len(parts) == 2:
        return (parts[0], parts[1])
    return None


def is_valid_relpath(relpath: str) -> bool:
    """Validate a script path relative to SCRIPTS_DIR: either a flat
    `name.js`, or a one-level-deep `folder/main.js` / `folder/spN.js`."""
    split = _split_relpath(relpath)
    if split is None:
        return False
    folder, fname = split
    if folder is None:
        return is_valid_filename(fname)
    if not FOLDER_NAME_RE.match(folder) or folder in (".", ".."):
        return False
    if not (fname.lower() == MAIN_FILENAME or SP_RE.match(fname)):
        return False
    return True


def safe_script_path(relpath: str) -> Optional[Path]:
    """Resolve a relpath ("name.js" or "folder/main.js"/"folder/spN.js") to a
    path guaranteed to live inside SCRIPTS_DIR."""
    if not is_valid_relpath(relpath):
        return None
    candidate = (SCRIPTS_DIR / relpath).resolve()
    try:
        candidate.relative_to(SCRIPTS_DIR.resolve())
    except ValueError:
        return None
    return candidate


def sp_sort_key(filename: str) -> tuple[int, str]:
    m = SP_RE.match(filename)
    if m:
        return (int(m.group(1)), filename)
    return (10**9, filename)


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
        self._sub_counters: dict[str, dict[str, int]] = {}  # "folder/spN.js" -> {"downloads": n}
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
            total = 0
            for e in self._entries.values():
                total += e.size
                total += sum(s.size for s in e.sub_scripts)
            return total

    def bump(self, name: str, field_name: str) -> None:
        with self._lock:
            entry = self._entries.get(name)
            if entry is None:
                return
            setattr(entry, field_name, getattr(entry, field_name) + 1)

    def bump_sub(self, folder: str, sp_filename: str) -> None:
        """Bump the download counter for one sp*.js file inside a group."""
        with self._lock:
            entry = self._entries.get(folder)
            if entry is None or not entry.is_group:
                return
            for sub in entry.sub_scripts:
                if sub.filename == f"{folder}/{sp_filename}":
                    sub.downloads += 1
                    self._sub_counters.setdefault(sub.filename, {"downloads": 0})
                    self._sub_counters[sub.filename]["downloads"] = sub.downloads
                    return

    def bump_download_for(self, relpath: str) -> None:
        """Bump the right counter (group or sub-script) for a served relpath."""
        split = _split_relpath(relpath)
        if split is None:
            return
        folder, fname = split
        if folder is None:
            self.bump(Path(fname).stem, "downloads")
        elif fname.lower() == MAIN_FILENAME:
            self.bump(folder, "downloads")
        else:
            self.bump_sub(folder, fname)

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
        if prior is not None and not prior.is_group:
            counters = {"views": prior.views, "downloads": prior.downloads, "copies": prior.copies}
        ensure_info_stub(name, stat.st_mtime)
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

    def _load_group(self, folder_path: Path) -> Optional[ScriptEntry]:
        """Build a grouped ScriptEntry from `folder/main.js` (+ `folder/spN.js`)."""
        main_path = folder_path / MAIN_FILENAME
        try:
            stat = main_path.stat()
            data = main_path.read_bytes()
        except (FileNotFoundError, OSError):
            return None
        checksum = hashlib.sha256(data).hexdigest()[:12]
        try:
            text = data.decode("utf-8", errors="replace")
        except Exception:
            text = ""
        name = folder_path.name
        prior = self._entries.get(name)
        created_at = self._created_at.get(name, stat.st_mtime)
        counters = self._counters.get(name, {"views": 0, "downloads": 0, "copies": 0})
        if prior is not None and prior.is_group:
            counters = {"views": prior.views, "downloads": prior.downloads, "copies": prior.copies}
        ensure_info_stub(name, stat.st_mtime)

        sub_scripts: list[SubScriptEntry] = []
        try:
            sp_files = sorted(
                (p for p in folder_path.iterdir() if p.is_file() and SP_RE.match(p.name)),
                key=lambda p: sp_sort_key(p.name),
            )
        except OSError:
            sp_files = []
        for order, sp_path in enumerate(sp_files, start=1):
            try:
                sp_stat = sp_path.stat()
                sp_data = sp_path.read_bytes()
            except (FileNotFoundError, OSError):
                continue
            sp_checksum = hashlib.sha256(sp_data).hexdigest()[:12]
            try:
                sp_text = sp_data.decode("utf-8", errors="replace")
            except Exception:
                sp_text = ""
            rel = f"{name}/{sp_path.name}"
            m = SP_RE.match(sp_path.name)
            label = f"SP{m.group(1)}" if m else sp_path.stem.upper()
            downloads = self._sub_counters.get(rel, {"downloads": 0})["downloads"]
            sub_scripts.append(
                SubScriptEntry(
                    filename=rel,
                    label=label,
                    order=order,
                    size=sp_stat.st_size,
                    checksum=sp_checksum,
                    lines=sp_text.count("\n") + (1 if sp_text and not sp_text.endswith("\n") else 0),
                    downloads=downloads,
                )
            )

        return ScriptEntry(
            filename=f"{name}/{MAIN_FILENAME}",
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
            is_group=True,
            folder=name,
            sub_scripts=sub_scripts,
        )

    def rescan(self) -> None:
        """Full resync against the filesystem. Cheap enough to call often,
        but the watcher normally makes this unnecessary except at startup."""
        with self._lock:
            current_names: set[str] = set()
            try:
                children = list(SCRIPTS_DIR.iterdir())
            except OSError:
                children = []
            for p in children:
                if p.is_file() and p.suffix == ".js" and is_valid_filename(p.name):
                    entry = self._load_one(p)
                    if entry is None:
                        continue
                    name = entry.name
                    current_names.add(name)
                    if name not in self._created_at:
                        self._created_at[name] = entry.created_at
                    self._entries[name] = entry
                    self._counters[name] = {"views": entry.views, "downloads": entry.downloads, "copies": entry.copies}
                elif p.is_dir() and FOLDER_NAME_RE.match(p.name) and (p / MAIN_FILENAME).is_file():
                    entry = self._load_group(p)
                    if entry is None:
                        continue
                    name = entry.name
                    current_names.add(name)
                    if name not in self._created_at:
                        self._created_at[name] = entry.created_at
                    self._entries[name] = entry
                    self._counters[name] = {"views": entry.views, "downloads": entry.downloads, "copies": entry.copies}
            # Remove entries whose backing file/folder disappeared.
            for name in list(self._entries.keys()):
                if name not in current_names:
                    del self._entries[name]
                    self._created_at.pop(name, None)
                    self._counters.pop(name, None)
            self.last_scan = time.time()

    def refresh_group(self, folder: str) -> None:
        """Recompute (or drop) the group entry for /script/{folder}/."""
        with self._lock:
            if not FOLDER_NAME_RE.match(folder):
                return
            folder_path = SCRIPTS_DIR / folder
            if not folder_path.is_dir() or not (folder_path / MAIN_FILENAME).is_file():
                if folder in self._entries and self._entries[folder].is_group:
                    del self._entries[folder]
                    self._created_at.pop(folder, None)
                    self._counters.pop(folder, None)
                self.last_scan = time.time()
                return
            entry = self._load_group(folder_path)
            if entry is None:
                return
            if folder not in self._created_at:
                self._created_at[folder] = entry.created_at
            self._entries[folder] = entry
            self._counters[folder] = {"views": entry.views, "downloads": entry.downloads, "copies": entry.copies}
            self.last_scan = time.time()

    def refresh_file(self, relpath: str) -> None:
        """Refresh (or remove) the index entry for a single relpath, which
        may be a flat "name.js" or a nested "folder/main.js"/"folder/spN.js"."""
        with self._lock:
            split = _split_relpath(relpath)
            if split is None:
                return
            folder, fname = split
            if folder is not None:
                self.refresh_group(folder)
                return
            path = SCRIPTS_DIR / fname
            name = Path(fname).stem
            if not path.exists():
                if name in self._entries and not self._entries[name].is_group:
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
        observer.schedule(handler, str(SCRIPTS_DIR), recursive=True)
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

    def _relpath(self, src_path: str) -> Optional[str]:
        try:
            rel = Path(src_path).resolve().relative_to(SCRIPTS_DIR.resolve())
        except ValueError:
            return None
        # Only care about at most one level of nesting (name.js or folder/file.js).
        parts = rel.parts
        if len(parts) == 1 or len(parts) == 2:
            return "/".join(parts)
        return None

    def _schedule(self, src_path: str) -> None:
        if not src_path.endswith(".js"):
            return
        relpath = self._relpath(src_path)
        if relpath is None:
            return
        with self._timer_lock:
            self._pending[relpath] = time.time() + self.DEBOUNCE_SECONDS

        def worker(rp: str, fire_at: float) -> None:
            delay = fire_at - time.time()
            if delay > 0:
                time.sleep(delay)
            with self._timer_lock:
                if self._pending.get(rp) != fire_at:
                    return  # a newer event superseded this one
                del self._pending[rp]
            self.index.refresh_file(rp)

        threading.Thread(target=worker, args=(relpath, self._pending[relpath]), daemon=True).start()

    def on_created(self, event):
        if not event.is_directory:
            self._schedule(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self._schedule(event.src_path)

    def on_deleted(self, event):
        if not event.is_directory:
            self._schedule(event.src_path)
        else:
            # A whole group folder got removed -- drop its entry directly.
            rel = self._relpath(event.src_path)
            if rel and "/" not in rel:
                self.index.refresh_group(rel)

    def on_moved(self, event):
        if not event.is_directory:
            self._schedule(event.src_path)
            self._schedule(event.dest_path)


index = ScriptIndex()
