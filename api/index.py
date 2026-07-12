"""Vercel Python (ASGI) entrypoint.

Vercel discovers this file via vercel.json and serves the `app` object
directly (its Python runtime supports ASGI apps). See vercel.json at the
repo root for the routing config, and README/replit.md for the important
caveat that /script writes are NOT persistent on Vercel.
"""
from app.main import app  # noqa: F401
