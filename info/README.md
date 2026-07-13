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
