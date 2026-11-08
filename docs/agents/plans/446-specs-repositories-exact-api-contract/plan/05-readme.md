# README: open markers and decisions summary

- Open-markers table: remove the `api.md#listing`, `api.md#contract` and
  `security.md#errors-and-logging` rows; the `ui.md#sync-ux` row becomes "sync-state polling
  interval" settled by #447 only. Add rows for any marker text extended in step 04 only if the
  row wording no longer matches.
- Decisions summary: "Paginated, filterable listing" → served by `POST /repositories/mine.json`
  from the database; add "Repo ref: `githubId` or `fullName`, `githubId` canonical"; Add is
  idempotent.
- "Product changes folded by #452": make sure nothing mentions a `GET` side-effect exception for
  `architecture/security.md`; the routes doc to create at fold time is
  `backend/routes/repositories.md`.
- Index: `api.md` row → "Routes, request/response contract, repo ref, sync state and polling,
  errors, access rules".

## Files to Change
- `docs/agents/specs/repos/README.md` — markers table, decisions summary, #452 checklist, index.
