# Issue: Backend: integrations module with Personal Access Token as first type

## Description
Part of #295 (GitHub integrations). Implement the backend `integrations` module: the generic, type-agnostic part (entity, encryption, rate limits, generic API) plus the Personal Access Token (`pat`) type, so the feature can be tested end-to-end. The frontend is #301; the OAuth App and GitHub App types are #302 and #303.

The specs in `docs/agents/specs/integrations/` are the **source of truth**: `model.md`, `api.md`, `security.md` and `type-contract.md` for the generic module, and `types/pat.md` for the PAT type. Where this issue and the specs disagree, the specs win.

## Problem
Kerghan can only read GitHub unauthenticated, so it sees public data only and shares the 60 requests/hour per-IP limit. Users need a place to register their own GitHub credentials, stored safely by the backend, before any later feature (e.g. a backend issue-fetching proxy, out of scope here) can use them.

## Expected Behavior
- An authenticated user can list, show, create, rename, replace the credential of, test and delete their own PAT integrations, through the routes in `api.md`.
- Secrets are encrypted at rest with AES-256-GCM, bound to their row (AAD), and never returned, logged or echoed.
- Another user's integration is indistinguishable from a missing one (404); admins get no access.
- The app refuses to boot when `KERGHAN_INTEGRATIONS_KEY` is missing or malformed.
- Existing behaviour is unchanged: issue fetching stays unauthenticated and frontend-side, and Navi warm-up is unaffected.

## Solution
### Module
- New NestJS module `integrations`, classified **Always-on** per `docs/agents/architecture/backend.md` (it exposes HTTP routes, so it is registered in `AppModule`).
- Controllers stay thin: validation in DTOs, everything else in the module's services.

### Data
- `Integration` entity and the `integrations` table (`model.md`), including the documented physical FK exception `user_id → auth_users.id ON DELETE CASCADE`.
- `integrations_credential_lockouts` table for the failure cool-off.
- One additive migration per table, each with a working `down`.

### Secrets
- `Secret` value type whose `toString`, `toJSON` and `util.inspect` return `[REDACTED]`.
- Encryption service: AES-256-GCM with Node's `crypto`, fresh 96-bit IV, AAD `"<uuid>:<type>"`, four `secret_*` columns, and a key id (first 8 hex chars of SHA-256 over the raw key).
- Key-id mismatch or auth-tag failure → `undecryptable`, without decrypting on a mismatch.
- Single key only. Rotation is #305.

### Config (read once at boot, DI, no env reads inside classes)
- `KERGHAN_INTEGRATIONS_KEY` (required): 32 bytes, base64. Boot fails if it is missing, blank, not base64, the wrong length, equal to `KERGHAN_SECRET_KEY`, or equal to the public placeholder under `NODE_ENV=production`. The error never prints the value. The placeholder is defined once in code.
- Through `getNumberConfig`: `KERGHAN_INTEGRATIONS_MAX_PER_USER` (20), `KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS` (5), `KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS` (900000), `KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS` (30000).
- Wiring: docker-compose and `.env` samples, CircleCI and deploy config, and `docs/agents/environment-variables.md` (including how to generate a production key).

### Types
- Strategy interface and registry (`type-contract.md`). The generic code never branches on `type`.
- PAT strategy (`types/pat.md`): parse credential, validate against GitHub, capture metadata, mask, test connection, no-op delete.
- One injectable GitHub client service. All GitHub traffic goes through it, and it rethrows sanitized errors only.

### API (`api.md`)
- Routes: list mine, show, enabled types, create, rename, replace credential, test connection, delete.
- Owner-scoped queries (`uuid` + `user_id` in the query), owner lookup first, and responses built from an explicit allowlist.
- Per-action check order as specified (cool-off, cap, label uniqueness, then GitHub).
- Expiry computed on read.
- Rate limiting:
  - per-user create/replace failure cool-off: atomic upsert/increment, 423;
  - per-integration test cooldown: atomic claim, 429 + `Retry-After`.
- Error codes added to `ErrorCodes`. Also add a `422 → UNPROCESSABLE_ENTITY` category code, and introduce the `Retry-After` header.
- Every route is cache class `never` (`@CachePolicy` at controller level, `X-Skip-Cache`, `Cache-Control: no-store`). No route goes in Navi.

### Verification
- Jest unit and e2e specs cover every **Required tests** section of `model.md`, `api.md`, `security.md`, `type-contract.md` and `types/pat.md`. That includes cross-user and admin access, encryption tamper and key-id mismatch, boot validation, rate limiting and concurrency, the response shape, and canary credentials. GitHub is replaced by the fake client in every spec except the client's own.
- `yarn lint` and coverage pass inside docker-compose.
- The security, data-access and cache agents report no violations.
- The PR documents the manual smoke check from `types/pat.md`, using a real throwaway token.

## Benefits
- Users can register private-repo-capable, per-credential-rate-limited GitHub access, tested end-to-end with PATs.
- The generic module and type contract make #302 (OAuth App) and #303 (GitHub App) additive, with no migration.
