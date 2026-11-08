# README: markers, decisions, #452 checklist; consistency check

`README.md`: drop the #449 rows from "Open markers"; extend the "GitHub handle" bullet of the
decisions summary; add to "Product changes folded by #452": `modules/auth/default-user.md`
(narrowed block, replaced rationale, `githubHandle` not managed), `modules/auth.md` (exported
handle reader, admin routes unchanged), `backend/routes/auth.md` (`PATCH /auth/account.json`
body/response and password rule, new `POST /auth/account/mine.json`); update the #449 sub-issues
row's file list (`api.md`, `sync.md` too) and the index row of `model.md`.

Then grep the folder: no "settled by #449" left, anchors resolve, no contradiction with the
pre-existing "right after a handle change" wording.

## Files to Change

- `docs/agents/specs/repos/README.md` — markers, decisions, #452 checklist, sub-issues row.
