# Backend Plan: Standalone: keep the login on a loopback host when published on a non-loopback bind

Main plan: [plan.md](plan.md)

## Shared contracts

- Consume `KERGHAN_COOKIE_SECURE`: exact `false` → never `Secure`; exact `loopback` → per request;
  anything else or unset → always `Secure`.
- `loopback` mode: no `Secure` only when the raw `Host` header names a loopback host (`localhost`,
  IPv4 `127.0.0.0/8`, `[::1]`; port stripped, case-insensitive, exact match) **and**
  `X-Forwarded-Proto` has no `https` entry. Missing/malformed `Host` → `Secure`.
- Read `req.headers.host`, never `X-Forwarded-Host` or `req.hostname` (Tent forwards `Host`
  unchanged).

## Implementation Steps

### Step 1 — Per-request `Secure` decision

In `backend/src/auth/auth-cookies.ts`:

- Change `cookieSecure(configService)` to `cookieSecure(configService, req?: Request)`:
  - `'false'` → `false`;
  - `'loopback'` → `!(req && isLoopbackHost(req.headers.host) && !forwardedHttps(req))`;
  - anything else → `true`.
- Add small exported pure helpers (same file, or `backend/src/auth/loopback-host.ts` if it reads
  better), each with JSDoc:
  - `isLoopbackHost(host: string | undefined): boolean` — strips the port (handle the bracketed
    IPv6 form `[::1]:port`), lowercases, and matches exactly `localhost`, a strict IPv4 literal with
    first octet `127` (four decimal octets 0–255, no leading `+`/spaces), or `[::1]`.
  - `forwardedHttps(req: Request): boolean` — `true` when `X-Forwarded-Proto` (string or array)
    contains an `https` entry, case-insensitive, after splitting on commas and trimming.
- Take the request from the response instead of changing every signature: Express sets `res.req`.
  `setSessionCookies` and `clearSessionCookies` call `cookieSecure(configService, res.req)`, so the
  callers in `auth.controller.ts` (logout, refresh, status), `auth-response.ts`
  (`respondWithSession`, also used by the device-authorization poll) and
  `clearSessionCookiesOnUnauthorized` need no change, and setting and clearing always use the same
  per-request decision. When `res.req` is absent, `loopback` mode falls back to `Secure`.
- Update the JSDoc of `cookieSecure`, `setSessionCookies` and `clearSessionCookies` to describe the
  three values.
- Keep controllers thin: no logic moves into `AuthController`.

### Step 2 — Specs and docs

- `backend/src/auth/tests/auth-cookies.spec.ts` (extend the `KERGHAN_COOKIE_SECURE` describe; the
  response mocks gain a `req` with `headers`):
  - `loopback` + `Host` `127.0.0.1:5050`, `127.1.2.3`, `localhost`, `LOCALHOST:80`, `[::1]:5050` →
    no `Secure` on all three cookies, for both set and clear;
  - `loopback` + `Host` `192.168.1.10:5050`, `example.com`, `localhost.evil.com`,
    `127.0.0.1.nip.io`, `kerghan.localhost`, `256.0.0.1`, `[::2]`, empty, missing → `Secure`;
  - `loopback` + loopback `Host` + `X-Forwarded-Proto: https` (also `HTTPS` and `http, https`) →
    `Secure`;
  - `loopback` with no `res.req` → `Secure`;
  - `false` → never `Secure` regardless of host; `true`, `Loopback`, typo, unset → `Secure`.
  - Unit tests for `isLoopbackHost` / `forwardedHttps` directly if they are exported helpers.
- Docs:
  - `docs/agents/environment-variables/backend.md` — the `KERGHAN_COOKIE_SECURE` row: the three
    values and the `loopback` rule.
  - `docs/agents/backend/routes/auth/shared.md` (~line 76) and `docs/agents/modules/auth/sessions.md`
    (~line 63) — `Secure` unless `false`, or unless `loopback` and the request host is loopback over
    plain HTTP.
  - `docs/agents/architecture/security.md` (~lines 22 and 121) — the `loopback` mode, why `Host`
    spoofing and the untrusted `X-Forwarded-Proto` are acceptable (each only affects the spoofing
    client's own response, and `X-Forwarded-Proto` can only add `Secure`), and the accepted
    port-scope exposure of a non-`Secure` `127.0.0.1` cookie.

## Files to Change

- `backend/src/auth/auth-cookies.ts` — `cookieSecure(configService, req)`, loopback/forwarded-proto
  helpers, `res.req` in set/clear.
- `backend/src/auth/loopback-host.ts` — optional new file for the helpers.
- `backend/src/auth/tests/auth-cookies.spec.ts` — `loopback` mode specs.
- `docs/agents/environment-variables/backend.md`, `docs/agents/backend/routes/auth/shared.md`,
  `docs/agents/modules/auth/sessions.md`, `docs/agents/architecture/security.md` — docs.

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` and
  `docker-compose run --rm kerghan_tests yarn lint` (CI jobs: backend tests / lint).

## Notes

- The auth routes are `@CachePolicy(CacheClass.Never)` (see `auth-response.ts`), so Tent never
  shares a host-dependent cookie response; no cache change is needed. Confirm nothing else calls
  `setSessionCookies` on a cacheable route.
- Do not enable Express `trust proxy` or read `X-Forwarded-Host`: both would let a client choose the
  host more easily and add nothing here.
