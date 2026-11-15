# Workers config

Add `WorkersConfig`, an injectable read once at boot through `ConfigService`, following `RepositoriesConfig` (`backend/src/repositories/repositories-config.ts`): a `positiveInteger` helper over `getNumberConfig`, exported default constants, readonly fields.

| Field | Env var | Default |
|---|---|---|
| `poolSize` | `KERGHAN_WORKERS_POOL_SIZE` | `3` |
| `cooldownMs` | `KERGHAN_WORKERS_COOLDOWN_MS` | `5000` |
| `maxRetries` | `KERGHAN_WORKERS_MAX_RETRIES` | `3` |
| `sleepMs` | `KERGHAN_WORKERS_SLEEP_MS` | `500` |

An unset, non-numeric, non-integer or non-positive value falls back to the default and never fails boot. Also export the fixed constants: the drain timeout (`WORKERS_DRAIN_TIMEOUT_MS = 10_000`) and the drain poll interval. They are not env vars, but `WorkersService` takes them through its constructor/config so specs can override them. Full JSDoc on every export (the project lints it).

## Files to Change
- `backend/src/workers/workers-config.ts` — new `WorkersConfig` and the default/fixed constants.
