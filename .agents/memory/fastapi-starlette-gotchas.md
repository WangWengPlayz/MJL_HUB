---
name: FastAPI/Starlette + passlib/bcrypt gotchas
description: Version-specific breakages seen when installing FastAPI/Starlette and passlib/bcrypt fresh via the package manager.
---

- Recent Starlette (installed alongside FastAPI 0.139+ in this environment resolved to starlette 1.3.1) requires
  `Jinja2Templates.TemplateResponse(request, name, context)` with `request` as the first positional arg — the old
  `TemplateResponse(name, {"request": request, ...})` form raises `TypeError: unhashable type: 'dict'` deep inside
  Jinja2's template cache, which is a confusing error far from the real cause.
  **Why:** Starlette changed the signature; the old dict-based call still parses but silently misroutes args.
  **How to apply:** Always pass `request` as the first arg to `TemplateResponse`, keep `request` out of the context dict.

- `passlib`'s bcrypt backend (`CryptContext(schemes=["bcrypt"])`) crashes on install with modern `bcrypt` (5.x):
  `AttributeError: module 'bcrypt' has no attribute '__about__'`, and can also fail with
  `ValueError: password cannot be longer than 72 bytes` during its own internal self-test, even for short passwords.
  **Why:** passlib's version-sniffing code assumes an older bcrypt API that newer bcrypt releases removed.
  **How to apply:** Skip passlib for bcrypt hashing; call the `bcrypt` package directly
  (`bcrypt.hashpw(pw.encode()[:72], bcrypt.gensalt())` / `bcrypt.checkpw`) instead.
