# Backend Plan: Harden CORS configuration (KERGHAN_ALLOWED_ORIGINS)

Main plan: [plan.md](plan.md)

## Overview
Today `KERGHAN_ALLOWED_ORIGINS` is never read and `main.ts` never calls `app.enableCors`. This plan adds a pure resolver, `buildCorsOptions(configService)`, in `backend/src/core/cors-config.ts`. The resolver validates the allowlist at boot and returns either `undefined` (CORS disabled) or the options for Nest's `enableCors`. `main.ts` stays thin: it only applies whatever the resolver returns.

## Context
Resolution order, all read once at boot through `ConfigService`:

1. `KERGHAN_ALLOWED_ORIGINS` is set and non-blank: split on `,` and trim each entry. An empty entry (e.g. `a,,b` or a trailing comma) is an error.
2. Otherwise, `FRONTEND_BASE_URL` is set and non-blank: the allowlist is `[new URL(FRONTEND_BASE_URL).origin]`, and any path is dropped. If the URL can't be parsed, or its scheme isn't http/https, boot fails.
3. Neither is set: return `undefined`, so CORS stays disabled and the backend stays same-origin only, as today.

Validation of explicit `KERGHAN_ALLOWED_ORIGINS` entries:
- Each entry must satisfy `new URL(entry)`, use the `http:` or `https:` protocol, and satisfy `new URL(entry).origin === entry`. That rules out paths (including a trailing `/`), queries, fragments, credentials, and uppercase or default-port variants that normalise differently.
- Wildcard `*`:
  - When `NODE_ENV === 'production'`, it throws.
  - Otherwise it must be the sole entry (`*` mixed with other entries throws) and maps to `origin: true`. The `cors` package then reflects the request origin, because a literal `*` can't be combined with `credentials: true`.
- Errors are `Error`s whose message names the variable and the offending entry, for example ``Invalid KERGHAN_ALLOWED_ORIGINS entry "http://x.com/": must be a bare origin (scheme://host[:port])``. `bootstrap().catch` in `main.ts` already logs the error and runs `process.exit(1)`.

Returned options: `{ origin: string[] | true, credentials: true }`, frozen.

## Steps

- [01 — Add CORS config resolver and specs](backend/01-add-cors-config-resolver.md)
- [02 — Wire the resolver into main.ts](backend/02-wire-enable-cors.md)
- [03 — Update env-var docs](backend/03-update-docs.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_app yarn test` and `docker-compose run --rm kerghan_app yarn lint` (CI jobs: `backend_tests`, `backend_checks`). Check the exact service name in `docker-compose.yml`.

## Notes
- `FRONTEND_BASE_URL` is already consumed by `backend/src/auth/password-reset.service.ts` (reset links), so the doc row calling it *Reserved, not yet read* is stale. Fix that row as part of step 03.
- `NODE_ENV` becomes consumed again, only for the wildcard guard. The cookie flags stay environment-independent.
- The frontend is served same-origin through the proxy, so the dev `.env` value `http://localhost:3000` changes nothing for normal use. It only allows direct cross-origin calls from that origin.
- With an array `origin`, the `cors` package sets `Vary: Origin`. The proxy and Navi cache responses keyed without `Origin`. If a cached response is ever served cross-origin, allowlist headers could leak between origins. This is low risk today, because there are no cross-origin consumers. Flag it for security review, but don't change the proxy here.
- Keep `main.ts` free of parsing logic, per the thin-controller/bootstrap boundary.
