# Catalog the five new env vars

`docs/agents/environment-variables.md` already has a row for
`KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` (added by an earlier sub-issue). Add five more rows to the
same "## 1. Backend application runtime" table, immediately after that existing row, sourced from
`backend/src/auth/authorization-request-abuse-guard.service.ts`'s defaults:

| Variable | Status | Purpose | Source |
|---|---|---|---|
| `KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT` | **Consumed**, optional | Per-IP/per-username request count allowed within the sliding window before `create` is throttled. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_CREATE_WINDOW_MS` | **Consumed**, optional | Sliding window (milliseconds) the `create` rate limit above counts requests over. Defaults to `60000` (1 minute). | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER` | **Consumed**, optional | Cap on a resolved user's simultaneous `open` authorization requests; the oldest is evicted (flipped to `expired`) to make room for a new one rather than rejecting it. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS` | **Consumed**, optional | Consecutive wrong-password `authorize` attempts, per request row, that trip the cool-off lockout. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS` | **Consumed**, optional | Cool-off duration (milliseconds) once the max-attempts threshold above is reached. Defaults to `300000` (5 minutes). | `backend/src/auth/authorization-request-abuse-guard.service.ts` |

Double-check `.env.dev.sample` while editing — if these vars aren't already listed there, note
that in this doc's existing "nothing here should drift from that file without a reason noted
below" spirit (adding them to `.env.dev.sample` itself would be a code/config change and is out
of this issue's scope; if they're absent, leave a short note in the table or prose saying they're
undocumented-but-defaulted in dev, don't silently ignore the discrepancy).

## Files to Change

- `docs/agents/environment-variables.md` — add the five rows above to the "## 1. Backend
  application runtime" table, right after the existing `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` row.
