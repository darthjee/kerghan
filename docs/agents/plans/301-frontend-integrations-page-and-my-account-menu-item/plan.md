# Plan: Frontend: Integrations page and My account menu item

Issue: [301-frontend-integrations-page-and-my-account-menu-item.md](../../issues/301-frontend-integrations-page-and-my-account-menu-item.md)

## Overview
Build the `#/account/integrations` page and the *Integrations* item in the "My account" dropdown, consuming the integrations API from #300 and following `docs/agents/specs/integrations/ui.md` and `types/pat.md`. The backend adds one response field, `nextTestAt`, so the frontend can disable *Test* during the cooldown without knowing the backend's cooldown config. The frontend also teaches `ApiClient`/`ApiError` to carry `Retry-After`.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

- **`nextTestAt`** is a new field on every Integration response (list, show, create, rename, replace credential, test):
  - type `string | null`, ISO-8601 like the other dates;
  - value `lastTestedAt + KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS`, or `null` when `lastTestedAt` is `null`;
  - it may lie in the past (cooldown already over). The frontend enables *Test* when it is `null` or `<= now`.
  - Example: `"lastTestedAt": "2026-10-01T12:00:00.000Z", "nextTestAt": "2026-10-01T12:00:30.000Z"`.
- **Retry-After on 429:** `POST /integrations/:uuid/test.json` answers `429` `INTEGRATION_TEST_COOLDOWN` with a `Retry-After` header (integer seconds). It is a header only, never in the body. Already delivered by #300.
- Everything else (routes, response fields, error codes) is exactly as in `docs/agents/specs/integrations/api.md`.
