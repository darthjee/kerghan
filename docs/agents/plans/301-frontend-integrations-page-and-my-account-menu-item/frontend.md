# Frontend Plan: Frontend: Integrations page and My account menu item

Main plan: [plan.md](plan.md)

## Shared contracts

- Rely on `nextTestAt` (`string | null`, ISO-8601) on every Integration: *Test* is enabled when it is `null` or `<= now`.
- After a `429` `INTEGRATION_TEST_COOLDOWN`, disable *Test* for the `Retry-After` header's seconds.
- Routes, fields and error codes are as in `docs/agents/specs/integrations/api.md`.

## Steps

- [01 — Carry Retry-After on ApiError](frontend/01-retry-after-on-api-error.md)
- [02 — IntegrationsClient](frontend/02-integrations-client.md)
- [03 — Route, menu item and page wiring](frontend/03-route-menu-and-wiring.md)
- [04 — Integrations page controller](frontend/04-integrations-controller.md)
- [05 — Integrations page rendering and PAT form](frontend/05-integrations-rendering.md)

## CI Checks
- `frontend`: `yarn lint` and `yarn coverage` run inside docker-compose (CI runs `npm run lint` / `npm run coverage` in `frontend/`).

## Notes
- Follow the spec's *Required tests* list in `ui.md` exactly, including the canary test (a canary credential never reaches `console`, `localStorage`, `sessionStorage` or the URL).
- Rename UX (inline or modal) is the implementer's choice. Follow the closest existing pattern.
- Only `pat` is implemented. Build the type picker and per-type forms as a small registry keyed by `type`, so the OAuth App and GitHub App sub-issues only add entries.
- A manual check in the running app (add, test, rename, replace and remove a PAT) needs a real GitHub token. It's done by the user, not in CI.
