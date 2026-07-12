"""MJL HUB - automated script hosting platform (FastAPI application)."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.activity_log import log_security
from app.auth import ensure_bootstrap_admin
from app.config import BASE_DIR
from app.routers import admin, api, pages
from app.scripts_index import index
from app.security import SecurityHeadersMiddleware, limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    generated_password = ensure_bootstrap_admin()
    if generated_password:
        print("=" * 60)
        print(f"MJL HUB: created bootstrap admin account 'admin'")
        print(f"MJL HUB: generated password: {generated_password}")
        print("Log in at /login and change this password immediately.")
        print("=" * 60)
    index.start_watcher()
    yield
    index.stop_watcher()


app = FastAPI(title="MJL HUB", docs_url=None, redoc_url=None, lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SecurityHeadersMiddleware)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "app" / "static")), name="static")

app.include_router(pages.router)
app.include_router(api.router)
app.include_router(admin.router)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code in (401, 403, 404) and request.url.path not in ("/login",):
        pass
    if exc.status_code >= 400 and exc.status_code not in (404,):
        log_security(
            "http_error",
            detail=f"{exc.status_code} {exc.detail}",
            ip=request.client.host if request.client else None,
            path=str(request.url.path),
        )
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse({"error": "invalid request", "details": exc.errors()}, status_code=422)
