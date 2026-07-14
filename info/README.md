# /info

Optional per-script metadata, shown on the homepage cards and the script
detail page. Same philosophy as `/script/`: drop or edit a file here and it
shows up on the site automatically — no restart, no manual site edits.

For a script at `script/{name}.js`, create/edit `info/{name}.json`:

```json
{
  "title": "MJL Auto Farm",
  "description": "Auto farming script.",
  "version": "1.0.0",
  "creator": "Mart John Labaco",
  "credits": "MJL",
  "lastUpdated": "2026-07-13"
}
```

All fields are optional. If the file is missing, or a field is blank, the
site falls back to defaults (title = script name, version "1.0.0", no
description/creator/credits, and lastUpdated = the script file's own
last-modified date).

The first time a script appears with no matching info file yet, MJL HUB
writes a starter `info/{name}.json` for you automatically (with the exact
current date in `lastUpdated`) so there's something to edit in place —
it will never overwrite a file you've already created.

## Grouped scripts (main.js + support scripts)

A script can also be a **folder** instead of a single file, for cases where
your main script loads one or more support scripts:

```
script/
  MyScript/
    main.js   <- the script users load; shown as the card/page content
    sp1.js    <- a support script main.js pulls in
    sp2.js
```

- The folder name (`MyScript`) becomes the script's name, exactly like a
  bare `MyScript.js` would.
- `main.js` is required — a folder without one is ignored.
- Support files must be named `sp1.js`, `sp2.js`, `sp3.js`, ... (any count).
- Metadata still lives at `info/MyScript.json`, same as a flat script.
- On the site, `MyScript` shows as one card/page with small "SP" pills next
  to `main.js` — click one to see its raw URL and loader without leaving the
  page. `main.js`'s own loader (`loadstring(game:HttpGet(...))()`) is what
  gets copied by "Copy Loader"; the sp files are meant to be fetched by
  `main.js` itself, but each also has its own raw URL if you need it directly.

Bare `script/name.js` files keep working exactly as before — the two shapes
are fully interchangeable.
