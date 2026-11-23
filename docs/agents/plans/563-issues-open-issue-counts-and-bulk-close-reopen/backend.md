# Backend Plan: Issues: open-issue counts and bulk close/reopen

Main plan: [plan.md](plan.md)

## Shared contracts

Produce the route `POST /projects/:projectId/issues/bulk-state.json`:

- **Body:** `{ issueIds: uuid[1..100], state: "open" | "closed" }`, with duplicates rejected case-insensitively.
- **`200` response:** `{ state, changed, unchanged, notFound }`. The ids are lowercased and keep the request order.
- **Errors:** `400 VALIDATION_FAILED`, `429 ISSUE_EDIT_RATE_LIMITED` (weight = id count, nothing consumed on refusal) and `404 PROJECT_NOT_FOUND`.
- **Caching:** user scoped, `X-Skip-Cache: true`, `Cache-Control: no-store`. Nothing goes in Navi.

## Steps

- [01 — DTO and input type](backend/01-dto.md)
- [02 — Bulk state service](backend/02-bulk-service.md)
- [03 — Controller route and route table](backend/03-route.md)
- [04 — Edge-case specs and allowlist](backend/04-edge-case-specs.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI: `backend_tests` / `backend_db_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI: `backend_checks`)

## Notes

- The weighted limiter already exists: `IssueEditRateLimiter.consume(userId, weight)` is all or nothing. Do not change it.
- The single Edit stays unchanged: no project lock is added to it (`api/issues.md`, Concurrency).
- `edge-cases.coverage.spec.ts` reads `docs/` and `frontend/`, so it is skipped in the dev `kerghan_tests` container and runs in CI.
- Keep the controller thin (CLAUDE.md): all the logic goes in the service.
