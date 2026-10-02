# Plan: Backend: integrations module with Personal Access Token as first type

Issue: [300-backend-integrations-module-with-personal-access-token-as-first-type.md](../../issues/300-backend-integrations-module-with-personal-access-token-as-first-type.md)

## Overview

Build the always-on backend `integrations` module exactly as specified in
`docs/agents/specs/integrations/` (`model.md`, `api.md`, `security.md`, `type-contract.md`)
with the `pat` strategy from `types/pat.md`. The backend agent owns the module, the core
additions (error codes, `422` category, `Retry-After`), the migrations and every spec. The infra
agent wires the new env vars into the dev sample and the secret scanner, and documents them. The
specs are the source of truth: where this plan and the specs disagree, the specs win.

## Agents involved

- [backend](backend.md)
- [infra](infra.md)

## Shared contracts

### Env vars (read once at boot through `ConfigService`, never via `process.env` in classes)

| Variable | Required | Default | Rule |
|---|---|---|---|
| `KERGHAN_INTEGRATIONS_KEY` | yes | none | base64 of exactly 32 bytes. Boot fails if it is missing, blank, not base64, the wrong length, equal to `KERGHAN_SECRET_KEY`, or equal to the placeholder below while `NODE_ENV=production`. The error names the variable, never the value. |
| `KERGHAN_INTEGRATIONS_MAX_PER_USER` | no | `20` | via `getNumberConfig` |
| `KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS` | no | `5` | via `getNumberConfig` |
| `KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS` | no | `900000` | via `getNumberConfig` |
| `KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS` | no | `30000` | via `getNumberConfig` |

### Public dev/test placeholder key

```text
a2VyZ2hhbi1kZXYtaW50ZWdyYXRpb25zLWtleS0zMmI=
```

This is the base64 of the 32 ASCII bytes `kerghan-dev-integrations-key-32b`.

- The backend defines it once, as an exported constant
  `INTEGRATIONS_KEY_DEV_PLACEHOLDER` in `backend/src/integrations/integrations-key.ts`.
- Infra uses the same literal in `.env.dev.sample` and in the `.gitguardian.yaml` ignore list.

### No Navi or proxy changes

Every route is cache class `never`, and none belongs in `navi/navi_config.yaml`. Tent already
forwards `*.json` to the backend.
