# 05 — Docs

- Add this issue's row to the "Sub-issues" table in `docs/agents/specs/repos/README.md`:
  `| #466 | Repositories: Frontend — Repositories page and navbar link | implementation: [ui.md](ui.md), [testing.md](testing.md#frontend) |` (append "spec sync in …" if the PR had to correct any spec).
- If `api.md#errors`' retry-delay note or `ui.md` needed changes (e.g. the `retryAfterSeconds` client field), update them and list the change in the PR description.
- No permanent docs change: #452 folds them in.

## Files to Change
- `docs/agents/specs/repos/README.md` — the Sub-issues row.
