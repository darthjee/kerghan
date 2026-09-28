# Plan: Verify CSRF protection for state-changing requests (POST/PUT/DELETE)

Issue: [286-verify-csrf-protection-for-state-changing-requests-post-put-delete.md](../../issues/286-verify-csrf-protection-for-state-changing-requests-post-put-delete.md)

## Overview
Kerghan already relies on the `SameSite=Strict` `access_token` cookie and a same-origin-or-allowlist CORS policy, but nothing enforces CSRF protection explicitly. The backend adds a global `OriginGuard` that rejects any `POST`/`PUT`/`PATCH`/`DELETE` from another site with `403`, deciding from the `Sec-Fetch-Site` and `Origin` headers. It trusts the same origins as CORS, and it covers every mutating route, authenticated or not. The architect audits the proxy's header forwarding and documents the resulting CSRF posture in a new `docs/agents/architecture/security.md`.

## Agents involved

- [backend](backend.md)
- [architect](architect.md)

## Shared contracts

**Trusted origins**: the `origin` list returned by `buildCorsOptions(configService)` (`backend/src/core/cors-config.ts`), from `KERGHAN_ALLOWED_ORIGINS` or, as a fallback, `FRONTEND_BASE_URL`'s origin. `origin: true` (the dev-only `*`) means any origin is trusted. `undefined` (neither variable set) means an empty list. No new env var is introduced.

**Decision table** (applied only to `POST`, `PUT`, `PATCH`, `DELETE`; `GET`/`HEAD`/`OPTIONS` always pass):

| `Sec-Fetch-Site` | `Origin` | Result |
|---|---|---|
| `same-origin` or `none` | any | allow |
| `same-site` or `cross-site` | in trusted origins | allow |
| `same-site` or `cross-site` | absent or untrusted | **403** |
| absent | absent | allow (non-browser client: CLI, curl, cache warmer) |
| absent | trusted, or its host equals the request's `Host` header | allow (older browsers) |
| absent | any other value | **403** |

A `403` uses Nest's standard `ForbiddenException` body. The guard runs **before** `JwtGuard`, so a forged request to an authenticated route returns `403`, not `401`.

**Proxy requirement**: Tent must forward `Origin`, `Sec-Fetch-Site` and `Host` unchanged to the backend for `*.json` requests. The architect verifies this.
