# Plan: Specs: status.json contract for automatic login

Issue: [375-specs-status-json-contract-for-automatic-login.md](../../issues/375-specs-status-json-contract-for-automatic-login.md)

## Overview

This is a specs-only change, owned by the architect. It replaces the "Response contract" placeholder
in the default-user specs with the `POST /auth/status.json` contract for automatic login, so #370
can implement it without making any API decision of its own. No backend, frontend, cache or infra
code changes.

## Context

Today `status.json` (`backend/src/auth/auth.controller.ts`, `AuthService#status`) checks only
the `refresh_token` cookie. It returns `200 { loggedIn, isAdmin }` and clears the session cookies
when the answer is `loggedIn: false`. `login.json` mints a session through
`TokenService#issueTokens(user, keepSignedIn)` and sets cookies through `respondWithSession` /
`setSessionCookies` (`backend/src/auth/auth-response.ts`, `auth-cookies.ts`). Refresh-token rows
record no user agent or IP. `keepSignedIn` only selects the regular or persistent refresh TTL;
every session cookie gets a `maxAge`. `AuthController` carries `@CachePolicy(CacheClass.Never)`.

Decisions (from the refined issue):

- "No valid session" uses `status.json`'s existing check: the refresh cookie is missing, unknown,
  expired or revoked. A valid refresh cookie wins, unchanged, whoever its user is.
- The body is identical to a logged-in `status.json`: `{ loggedIn: true, isAdmin }`, with no
  `autoLogin` indicator.
- The cookies are exactly `login.json`'s (`setSessionCookies`).
- The session is regular: `keepSignedIn: false`, regular TTL.
- A disallowed IP, or the feature turned off, gets today's exact unauthenticated response with the
  cookies cleared.
- Caching is unchanged (never cached, `X-Skip-Cache`).
- The session appears in `sessions/mine.json` like any session. There are no new columns, and no
  user agent or IP is recorded.

## Implementation Steps

### Step 1 — Write the response contract in `automatic-login.md`

Replace the "Response contract" placeholder ("to be defined by #375; do not implement before
then") in `docs/agents/specs/default-user/automatic-login.md` with the decisions above. Use one
short subsection or bullet each for: when "no valid session" holds, response body, cookies
(names, paths, `httpOnly`, `secure`, `sameSite=strict`, `maxAge`, all via `setSessionCookies`),
session lifetime (`keepSignedIn: false`), the disallowed-IP and feature-off response, caching, and
session metadata. Make the "When automatic login applies" bullet consistent: `status.json` never
reads the access token, so validity is decided by the refresh cookie alone. Update the header line
"Implemented by #370 (`status.json` contract by #375)" if needed. Extend "Required tests" with:

- The body shape on automatic login (`{ loggedIn: true, isAdmin }` from the default user, no extra
  fields).
- The cookie names and attributes match `login.json`.
- The session is created with `keepSignedIn: false` and the regular refresh TTL.
- A revoked, expired or unknown refresh cookie from an allowed IP triggers automatic login.
- A disallowed IP gets exactly `{ loggedIn: false, isAdmin: false }` with the cookies cleared.
- The never-cache headers are present on the automatic-login response.
- The new session is listed in `sessions/mine.json` as `current`, with `keepSignedIn: false`.

### Step 2 — Close the open item in the specs `README.md`

In `docs/agents/specs/default-user/README.md`, remove the #375 bullet from "Open items" (the
effective-client-IP item for #371 stays). Adjust the sentence about placeholders accordingly, and
the `automatic-login.md` index row if its wording still says "(+ #375)" in a way that implies
pending work.

## Files to Change

- `docs/agents/specs/default-user/automatic-login.md`: the response contract replaces the
  placeholder, and "Required tests" is extended.
- `docs/agents/specs/default-user/README.md`: the #375 open item is removed, and the wording is
  aligned.

## Notes

- Keep the specs the source of truth. Do not touch `docs/agents/specs.md`, the permanent docs or
  `environment-variables.md` (#373 folds content later).
- Follow the existing writing style of the specs folder: short sentences, no new top-level
  sections beyond what the placeholder implies.
- No CI job lints Markdown; the change is docs-only.
