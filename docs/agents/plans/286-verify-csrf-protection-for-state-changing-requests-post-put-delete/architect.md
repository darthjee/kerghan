# Architect Plan: Verify CSRF protection for state-changing requests (POST/PUT/DELETE)

Main plan: [plan.md](plan.md)

## Shared contracts

- The backend enforces the decision table in [plan.md](plan.md#shared-contracts) through a global `OriginGuard` (`backend/src/core/origin.guard.ts`) that trusts the same origins as CORS.
- The architect must confirm that Tent forwards `Origin`, `Sec-Fetch-Site` and `Host` unchanged to the backend.

## Implementation Steps

### Step 1 — Audit: proxy header forwarding and remaining vectors
In the dev stack (`docker-compose`), send a `POST` to a `*.json` route through `kerghan_proxy` with `Origin`, `Sec-Fetch-Site` and `Host` set, and confirm they reach the backend unchanged. The backend access log or a temporary debug log shows this. If Tent strips or rewrites any of them, stop and raise it as a blocker: hand it to the `proxy` agent, or file a follow-up issue against Tent via `spawn_issue.sh`. Also confirm the other points from the issue's audit:
- every mutating route is `POST`/`PATCH`/`DELETE`, and the only `GET` is `/health.json`;
- the cookie attributes;
- CORS resolution;
- the default Nest body parsers still accept form-encoded bodies. This is harmless once the origin check is in place; record it as accepted.

A proxy-side side effect is out of scope, so don't fix it here: `CacheCleanupMiddleware` may clear cache folders on a forged mutating request before the backend rejects it. Record it in the security doc as residual risk, and open a follow-up issue if it proves real.

### Step 2 — Document the CSRF posture
Create `docs/agents/architecture/security.md` with a `## CSRF` section that covers:
- the layers: the `SameSite=Strict` `httpOnly` `Secure` cookie, the credentialed CORS allowlist, and `OriginGuard` with its decision table;
- why the unauthenticated routes are covered (login CSRF);
- why requests with neither header are allowed;
- the residual risks: same-site attackers from an allowlisted origin, browsers sending neither header, and the proxy cache-cleanup side effect from Step 1;
- the rules any future change must keep: no state change over `GET`, no relaxing `SameSite`, and header-based auth needs its own review.

Link the doc from `docs/agents/architecture.md` and `docs/agents/modules/auth.md`. Mention the guard in `docs/agents/architecture/backend.md` wherever the global guards are listed, and next to the CORS variables in `docs/agents/environment-variables.md` (the allowlist now also drives CSRF trust). Rewrite checklist item 5 in `.claude/agents/security.md`, which says CSRF is "not yet applicable": new mutating routes must not bypass `OriginGuard`, must not use `GET` for state changes, and must not weaken cookie or CORS settings.

## Files to Change
- `docs/agents/architecture/security.md` — new: CSRF posture.
- `docs/agents/architecture.md` — link to the security doc.
- `docs/agents/modules/auth.md` — link to and summarize the CSRF protection.
- `docs/agents/architecture/backend.md` — list `OriginGuard` among the global guards.
- `docs/agents/environment-variables.md` — note that `KERGHAN_ALLOWED_ORIGINS`/`FRONTEND_BASE_URL` also define CSRF-trusted origins.
- `.claude/agents/security.md` — update CSRF checklist item 5.

## Notes
- Step 2 depends on the backend plan's final guard name and file path; adjust the doc if the implementation deviates.
- Step 1 needs the dev stack running and must go through `docker-compose` only.
