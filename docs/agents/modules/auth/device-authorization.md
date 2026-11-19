# Auth — Device-Authorization Flow

## Device-authorization flow

A second way to log in, alongside the [JWT/refresh-token flow](sessions.md#jwtrefresh-token-flow): a not-yet-logged-in device
(the "requester") asks an already-logged-in device (the "approver", same account) to vouch for a
username, then polls until that device approves or denies it. The frontend's login modal
(`LoginModal`) is the single entry point for this — standalone login/register pages no longer
exist; the requester picks the "authorize with a logged-in device" mode instead of typing a
password — see `docs/agents/architecture/frontend.md`'s "Auth flow" section for the frontend side.

### Entity

`auth_authorization_requests` (`entities/authorization-request.entity.ts`), owned by this module:
`uuid` (unique, public identifier), `username` (as typed by the requester), `userId` (logical FK
into `auth_users`, `NULL` when `username` didn't resolve to a real user — such a row can never be
approved), `status` (the state machine below), `pollTokenHash` (unique, SHA-256 of the poll
token), `requestIp`/`requestUserAgent` (captured at creation), `approvedByUserId`, `createdAt`/
`expiresAt`/`resolvedAt`/`loggedAt`, and the hardening columns `authorizeFailedAttempts`/
`authorizeLockedUntil` (see "Hardening limits" below), and `keepSignedIn` (`keep_signed_in`,
boolean, default `false` — the requesting device's "keep me signed in" choice, applied to the
token minted by the winning poll; the approver sees it but cannot change it).

### Device-authorization routes

Same compact-table convention as [Routes](routes.md#routes) — see [Auth routes](../../backend/routes/auth.md)
for the full per-endpoint reference. Unlike the four classic routes, only `create`/`poll` are
`@Public()`; `mine`/`authorize`/`deny` require the default `JwtGuard` (the first non-admin
authenticated routes in the codebase), with the caller's own user id read from `req.user.sub`.

| Route | Auth | Body | Response |
|---|---|---|---|
| `POST /auth/authorization-requests.json` | `@Public()` | `{ username, keepSignedIn? }` | `{ uuid, pollToken, expiresAt }` |
| `POST /auth/authorization-requests/:uuid/poll.json` | `@Public()` | `{ pollToken }` | `{ status }`, plus `user` + the session cookies on the winning `approved` poll |
| `POST /auth/authorization-requests/mine.json` | `JwtGuard` | — | `{ requests: [{ uuid, requestIp, requestUserAgent, createdAt, expiresAt, keepSignedIn }] }` |
| `POST /auth/authorization-requests/:uuid/authorize.json` | `JwtGuard` | `{ password }` | `{ authorized: true }` |
| `POST /auth/authorization-requests/:uuid/deny.json` | `JwtGuard` | — | `{ denied: true }` |

`authorize`/`deny` collapse every business rejection (missing row, wrong owner, wrong status,
expired, wrong password, locked out) into the same `400 Bad Request` — never `401`/`403` — so
`ApiClient`'s refresh-and-retry logic is never triggered by a business rejection, only by an
actually-expired session.

### Status machine

`open → approved → logged` is the success path: `authorize` moves a request to `approved`, and
the winning poll claims it atomically (a guarded `UPDATE ... WHERE status = 'approved'`, so only
the first poll to observe `approved` can flip it to `logged` and mint a session — every other,
losing poll — including the requester's own next tick after that — gets back `{ status: 'logged'
}` with no credentials). `open → denied` covers an explicit `deny`. `open → expired` covers lazy
expiry (an `open` poll past its `expiresAt`) and the abuse-guard's open-cap eviction (see
"Hardening limits" below) — both flip an `open` row straight to `expired` without ever visiting
`approved`.

`logged → denied` covers a user who is no longer `approved` when the session would be minted
(e.g. denied by an admin between `authorize` and `poll`, or between the claim and the mint).
After the claim, the winning poll loads the user row and re-checks its status right before
minting (`AuthorizationRequestService#issueSessionFor`). A non-approved user never gets a
session: a conditional `UPDATE ... WHERE status = 'logged'` flips the request to `denied` and
the poll answers `{ status: "denied" }`, with no `user` and no cookies. A deny that lands after
the tokens were minted is covered by the deny's revocation and the session lookup.
`authorize.json` itself needs no status check: it is authenticated, so the gate answers a
non-approved caller with `401` before the endpoint runs.

### Poll-token contract

Mirrors refresh-token hashing: `create` mints a random poll token, returns it once in the
response body, and persists only its SHA-256 hash (`pollTokenHash`). A poll with an unknown
`uuid` or a `pollToken` that doesn't hash-match is indistinguishable — both `404`.

### Enumeration safety

`create` always responds with the same `{ uuid, pollToken, expiresAt }` shape and does the same
work regardless of whether `username` resolves to a real user — a non-matching username still
gets a `uuid`/`pollToken` back (backed by no persisted row when the caller is over the rate
limit, or a row with `userId: null` otherwise, which can never be approved). The abuse guard's
`isOverCreateLimit` reinforces this: it always computes both the per-IP and per-username counts
via `Promise.all`, never short-circuiting on whichever resolves first, so a caller can't binary-
search which count tripped the limit by observing response timing.

### Hardening limits (`AuthorizationRequestAbuseGuardService`)

Split out of `AuthorizationRequestService` to keep the core state machine focused — not exported
from `AuthModule`, an internal collaborator only. Exact defaults/env vars are catalogued in
`docs/agents/environment-variables.md`:

- **`create` rate limit** — per-IP and per-username request counts within a sliding window; over
  either limit, `create` still returns a normal-shaped response but persists no row and fires no
  event.
- **Concurrent-open cap** — a resolved user's simultaneous `open` requests are capped; hitting the
  cap evicts (expires) the oldest open request rather than rejecting the new `create`.
- **`authorize` cool-off lockout** — consecutive wrong-password `authorize` attempts, tracked per
  request row, trip a timed lockout once a threshold is reached. A locked-out attempt still runs
  the password compare (against a dummy bcrypt digest when the approver row itself is missing), so
  it stays timing-equivalent to a normal attempt.


