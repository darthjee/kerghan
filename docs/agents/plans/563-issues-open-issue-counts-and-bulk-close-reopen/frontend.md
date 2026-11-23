# Frontend Plan: Issues: open-issue counts and bulk close/reopen

Main plan: [plan.md](plan.md)

## Shared contracts

You can rely on:

- **The route:** `POST /projects/:projectId/issues/bulk-state.json`.
  - Body: `{ issueIds, state }`.
  - `200` response: `{ state, changed, unchanged, notFound }`, ids only, lowercased.
  - `429 ISSUE_EDIT_RATE_LIMITED` comes with `meta.retryAfterSeconds`, and nothing is applied.
  - `404` means the project is gone.
- **The count:** `openIssueCount`, an integer, on every project row. It is already served.

## Steps

- [01 — Client and the count column](frontend/01-client-and-count.md)
- [02 — Bulk selection controller](frontend/02-bulk-controller.md)
- [03 — Bulk bar, checkboxes and notice](frontend/03-bulk-bar.md)
- [04 — Security static spec, docs and spec note](frontend/04-docs.md)

## CI Checks

- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI: `jasmine`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI: `frontend-checks`)

## Notes

- The list re-reads once after a bulk call. Do not start the bounded re-read of #562 on the list.
- Selection is held in memory only, with nothing in storage (S4).
- The countdown reuses `RateLimitCountdownController` / `useRateLimitCountdown`. Do not write a new ticker.
