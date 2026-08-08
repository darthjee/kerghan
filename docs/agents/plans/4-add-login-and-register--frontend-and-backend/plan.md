# Plan: Add login and register, frontend and backend

Issue: [4-add-login-and-register--frontend-and-backend.md](../issues/4-add-login-and-register--frontend-and-backend.md)

## Overview

Add a `POST /accounts/register.json` backend endpoint (and rename the existing
`POST /login.json` to `POST /accounts/login.json` alongside it), plus the
frontend's first routing infrastructure, Bootstrap-based `Header`, and two
pages (`Home`, `Register`) that consume it. No backend specialist agent
exists yet in this project (see `.claude/agents/architect.md`), so the
architect implements the backend half directly; `frontend` implements the
frontend half.

## Agents involved

- [architect](architect.md) — backend: `Registrar`, `RegisterHandler`, route
  rename/addition, specs
- [frontend](frontend.md) — frontend: routing utils, Bootstrap setup,
  `Header`, `Home`, `Register`, `ApiClient`/`AccountsClient`, specs

## Shared contracts

**`POST /accounts/register.json`** (new)
- Request body (JSON): `{ username, email, password, password_confirmation }`
  — all four required, snake_case on the wire (the frontend's
  `AccountsClient.register({ username, email, password, passwordConfirmation })`
  maps its camelCase `passwordConfirmation` param to the wire's
  `password_confirmation` key).
- Success: `200`, body is `UserSerializer#asJson()` — `{ id, username, email }`
  — and a `Set-Cookie` session cookie (via `req.session.regenerate` +
  `req.session.userId`), same contract as login.
- Errors: `400` with `{ error: "<message>" }` for missing fields, a
  password/confirmation mismatch, a duplicate `username` (`"username is not
  available"`), a duplicate `email` (`"email is not available"`), or a
  malformed email (Sequelize's `isEmail` validation message, relayed as-is).

**`POST /accounts/login.json`** (renamed from `POST /login.json`)
- Request/response contract is unchanged — only the path moves. No known
  callers of the old path (checked `proxy/`), so this is a straight rename,
  not an added alias.
- The frontend's `AccountsClient` should point at the new path directly;
  there's no separate login page/client call being added in this issue (see
  issue's "Explicitly out of scope"), so this only matters for future issues
  that add a login form — noting it here so that work doesn't rediscover
  the renamed path.

Both routes already work through the existing Tent proxy `*.json` rule
(`proxy/dev_configuration/rules/backend.php` matches on `.json` suffix, not
a fixed path list) — **no proxy changes needed** for this issue.

## Notes (cross-cutting)

- **Security review**: per `architect.md`'s coordination rules, invoke the
  `security` agent after the backend routes land — this issue adds a new
  endpoint and touches authentication/session logic (session regeneration,
  password hashing, duplicate-account enumeration trade-off already reasoned
  through in the issue's "Performance & security considerations").
- **Cache review**: invoke the `cache` agent (read-only `X-Skip-Cache`
  check) after the backend routes land. Both routes are mutations (`POST`)
  that establish a session, so they're inherently user-scoped/non-cacheable
  and must not be added to `navi/navi_config.yaml`'s warm-up list — the
  review just needs to confirm the responses correctly carry
  `X-Skip-Cache` (or are naturally excluded since `default_proxy`'s
  cache-staleness middleware only applies to `GET`, which neither route
  uses — confirm during review rather than assuming).
- **Data-access review**: `data-access` should also confirm
  `UserSerializer` (reused by `RegisterHandler`) still never exposes
  `passwordDigest` now that a second code path constructs it.
- No `infra` work: no new services/compose changes; new frontend deps
  (`bootstrap`, `react-bootstrap`, `bootstrap-icons`) just need `yarn
  install` inside the existing `kerghan_fe` container.
