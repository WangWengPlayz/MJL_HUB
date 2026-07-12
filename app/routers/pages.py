"""HTML pages: homepage, script detail/source viewer, login, admin dashboard."""
from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.config import BASE_DIR, SITE_NAME
from app.deps import get_current_admin
from app.schemas import script_to_dict
from app.scripts_index import index

router = APIRouter()
templates = Jinja2Templates(directory=str(BASE_DIR / "app" / "templates"))


@router.get("/", response_class=HTMLResponse)
def homepage(request: Request):
    entries = index.all()
    newest = sorted(entries, key=lambda e: -e.created_at)[:6]
    recent = sorted(entries, key=lambda e: -e.updated_at)[:6]
    popular = sorted(entries, key=lambda e: -(e.views + e.downloads))[:6]
    tags = sorted({t for e in entries for t in e.tags})
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "site_name": SITE_NAME,
            "scripts": [script_to_dict(e, request) for e in entries],
            "newest": [script_to_dict(e, request) for e in newest],
            "recent": [script_to_dict(e, request) for e in recent],
            "popular": [script_to_dict(e, request) for e in popular],
            "tags": tags,
            "total": len(entries),
        },
    )


@router.get("/scripts/{name}", response_class=HTMLResponse)
def script_detail(request: Request, name: str):
    entry = index.get(name)
    if entry is None:
        return templates.TemplateResponse(request, "404.html", {"site_name": SITE_NAME}, status_code=404)
    index.bump(name, "views")
    return templates.TemplateResponse(
        request,
        "script.html",
        {"site_name": SITE_NAME, "script": script_to_dict(entry, request)},
    )


@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if get_current_admin(request):
        from fastapi.responses import RedirectResponse

        return RedirectResponse("/admin")
    return templates.TemplateResponse(request, "login.html", {"site_name": SITE_NAME})


@router.get("/admin", response_class=HTMLResponse)
def admin_page(request: Request):
    session = get_current_admin(request)
    if not session:
        from fastapi.responses import RedirectResponse

        return RedirectResponse("/login")
    return templates.TemplateResponse(
        request,
        "admin.html",
        {"site_name": SITE_NAME, "username": session.get("u"), "csrf": session.get("csrf")},
    )
