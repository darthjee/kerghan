# Issue: Specs: status.json contract for automatic login

## Description

Part of #366. Depends on #367, which created `docs/agents/specs/default-user/`. #370 (automatic login in `status.json`) builds against this contract.

Replace the "Response contract" placeholder in `docs/agents/specs/default-user/automatic-login.md` with the API contract of `POST /auth/status.json` when automatic login applies, and clear the matching open item in the specs `README.md`. Spec only, no code. #366 already decided that automatic login happens only in `status.json`, only without a valid session, and only for allowed client IPs.

## Problem

The default-user specs leave the `status.json` response contract open ("to be defined by #375; do not implement before then"), so #370 is blocked. The original issue text also assumed things the code does not do. Sessions do not record a user agent or IP. There is no session-scoped refresh cookie: every session cookie gets a `maxAge`, and `keepSignedIn` only changes the TTL. `status.json` checks only the `refresh_token` cookie, never the access token.

## Expected Behavior

The contract below is written in `automatic-login.md` (section "Response contract"), with its "Required tests" extended. The `README.md` open item for #375 is removed. #370 can implement automatic login without making any API decision of its own.

Decisions to record:

- **When "no valid session" holds.** It is the same check `status.json` already makes: the `refresh_token` cookie is missing, or it is unknown, expired or revoked (including a session revoked from another device). A valid refresh cookie wins and follows today's flow unchanged, whoever the user is (for example after an explicit login as another user). `status.json` stays passive and never revokes anything.
- **Response body.** It is identical to any logged-in `status.json`: `200 { loggedIn: true, isAdmin }`, with `isAdmin` taken from the default user. There is no `autoLogin` indicator. A frontend indicator is a separate issue and out of scope.
- **Cookies.** They are exactly what `login.json` sets, through the same `setSessionCookies` helper: httpOnly `access_token` (path `/`, access-token TTL), httpOnly `refresh_token` (path `/auth`, expiring with the refresh-token row) and readable `logged_in=1` (path `/`, same expiry), all `secure` and `sameSite=strict`.
- **Session lifetime.** The session is minted as a regular session (`keepSignedIn: false`, regular refresh TTL, not `KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS`). When it expires, the next `status.json` simply logs in again.
- **Disallowed IP (or feature off).** The response is byte-for-byte today's unauthenticated response, `200 { loggedIn: false, isAdmin: false }` with the session cookies cleared. Nothing hints that the feature exists.
- **Caching.** It is unchanged: `AuthController` keeps `@CachePolicy(CacheClass.Never)`, so the response stays non-cacheable and user-scoped (`X-Skip-Cache`).
- **Session metadata.** There are no new columns or fields. The session appears in `sessions/mine.json` like any password-login session (`startedAt`, `lastUsedAt`, `keepSignedIn: false`, `current`) and can be revoked the same way. No user agent or IP is recorded, as for any other session today.

Required tests to add: the body shape on automatic login; the cookie names and attributes matching `login.json`; `keepSignedIn: false` with the regular TTL; a revoked, expired or unknown refresh cookie from an allowed IP triggering automatic login; a disallowed IP getting the exact unauthenticated body with cookies cleared; the never-cache headers on the automatic-login response; the new session listed in `sessions/mine.json` as `current`.

## Solution

Edit `docs/agents/specs/default-user/automatic-login.md`: replace the "Response contract" placeholder with the decisions above, and add the new cases to its "Required tests". Update `docs/agents/specs/default-user/README.md`: drop the #375 open item and adjust the index row if needed. Owner: architect. No backend, frontend or cache changes in this issue.
