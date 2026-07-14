"""On-the-fly Lua/Roblox script obfuscation for public raw-file serving.

Design goals:
  * The file on disk (the "OG" source an admin uploaded/edited) is NEVER
    touched -- this module is a pure, read-only transform applied only to
    the response body when a script is fetched publicly.
  * The transform must be 100% safe: it must never change what the script
    *does* when executed, only how readable it is at rest. We do this by
    converting the ENTIRE source into a sequence of zero-padded decimal
    byte escapes (``\\ddd``) and wrapping it in a single ``loadstring(...)()``
    call. Because every byte of the payload becomes a fixed-width escape
    sequence, there is no Lua syntax left to break -- whatever the original
    script contained (quotes, backslashes, newlines, unicode, other
    obfuscation, anything) survives byte-for-byte through decode.
  * If a script already looks obfuscated (by us or by a third-party tool),
    we leave it completely alone -- no double-wrapping.
"""
from __future__ import annotations

import re

# Signatures left behind by common third-party Lua/Roblox obfuscators. If any
# of these show up we treat the file as already obfuscated and pass it
# through untouched.
_KNOWN_OBFUSCATOR_SIGNATURES = (
    "luraph",
    "moonsec",
    "prometheus",
    "ironbrew",
    "oxyrun",
    "vyra obfuscator",
    "obfuscator.io",
    "psu.lua",
)

# Our own wrapper marker -- if this is already present we never re-wrap.
_WRAPPER_MARKER = "-- Protected by MJL HUB"

# A run of many fixed-width "\ddd" escapes is the hallmark of the exact
# scheme we (and plenty of hobby "obfuscators") use to hide source.
_BYTE_ESCAPE_RE = re.compile(r"\\\d{1,3}")

# Files larger than this are skipped -- decimal-escaping is ~4x larger than
# the original, and there's no practical benefit to obfuscating something
# this big on every request.
_MAX_OBFUSCATE_BYTES = 2 * 1024 * 1024


def is_already_obfuscated(source: str) -> bool:
    """Best-effort heuristic: does this source already look obfuscated?

    Used so that scripts admins upload pre-obfuscated (by us on a previous
    fetch being pasted back in, or by any third-party tool) are served as-is
    instead of being wrapped a second time.
    """
    if not source or not source.strip():
        return False

    if _WRAPPER_MARKER in source:
        return True

    lowered = source.lower()
    if any(sig in lowered for sig in _KNOWN_OBFUSCATOR_SIGNATURES):
        return True

    # Heavily escaped payloads (lots of "\ddd" sequences covering most of a
    # long line) are the signature of this style of obfuscation.
    escapes = _BYTE_ESCAPE_RE.findall(source)
    if len(escapes) >= 40:
        escaped_chars = sum(len(e) for e in escapes)
        if escaped_chars >= 0.5 * len(source):
            return True

    # A single very long, low-whitespace line is typical of minified/obfuscated
    # output from third-party tools that don't use the escape scheme above.
    longest_line = max((len(line) for line in source.splitlines()), default=0)
    if longest_line > 1500:
        sample = source[:longest_line] if longest_line <= len(source) else source
        whitespace_ratio = sum(1 for c in sample if c.isspace()) / max(1, len(sample))
        if whitespace_ratio < 0.03:
            return True

    return False


def obfuscate(source: str) -> str:
    """Wrap `source` as a decimal byte-escaped string loaded via loadstring.

    This never inspects or parses Lua syntax, so it can never introduce a
    semantic bug -- decoding it at runtime reproduces the original bytes
    exactly, then executes them exactly as if they had been loaded directly.
    """
    data = source.encode("utf-8", errors="surrogatepass")
    escaped = "".join(f"\\{b:03d}" for b in data)
    return f'{_WRAPPER_MARKER}\nloadstring("{escaped}")()\n'


def maybe_obfuscate(source: str) -> str:
    """Public entry point used by the raw-serving route.

    Leaves the content untouched if it's empty, already obfuscated, or too
    large to be worth the round trip; otherwise returns the obfuscated form.
    The caller is responsible for never persisting the result to disk.
    """
    if not source:
        return source
    if len(source.encode("utf-8", errors="surrogatepass")) > _MAX_OBFUSCATE_BYTES:
        return source
    if is_already_obfuscated(source):
        return source
    return obfuscate(source)
