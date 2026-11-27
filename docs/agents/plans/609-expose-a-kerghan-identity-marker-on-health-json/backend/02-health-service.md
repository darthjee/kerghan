# Identity, version and component checks in `HealthService`

Move all probe-body logic into `HealthService` so the controller stays thin.

Types (exported from `health.service.ts`):

- `CheckState = 'up' | 'down'` (unchanged)
- `ReadinessChecks = { database: CheckState; workers: CheckState }`
- `ProbeStatus = 'ok' | 'degraded' | 'error'`
- `LivenessResult = { app: 'kerghan'; status: 'ok'; version?: string }`
- `ReadinessResult = { app: 'kerghan'; status: ProbeStatus; version?: string; checks: ReadinessChecks }`

Behaviour:

- **Version, read once.** Resolve `package.json` through `import.meta.url` (`join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json')`), following the `mail.module.ts` precedent for resolving a path relative to the compiled file. Read and `JSON.parse` it once, lazily on first use or in the constructor, and cache the result. If the read or the parse fails, or `version` is not a non-empty string, cache `undefined` and log one `warn` through `LoggerService` (context `HealthService`, no path or error text beyond the error class). Never throw. To keep this testable, accept the path or a reader through an optional constructor parameter or a small injectable function, without adding a provider or an env var. Keep production wiring unchanged.
- `liveness(): LivenessResult`: returns `{ app: 'kerghan', status: 'ok', ...(version ? { version } : {}) }`. It touches no dependency.
- `checkReadiness(): Promise<ReadinessResult>`: `database` from the existing `SELECT 1` check (unchanged, including its error log); `workers` from `WorkersService#isRunning()` (`true` → `up`, otherwise `down`; log a `warn` when down, at most once per transition to avoid log spam on frequent probes). `status` comes from a small pure helper: `error` if `database !== 'up'`, else `degraded` if `workers !== 'up'`, else `ok`.
- Inject `WorkersService` in the constructor (the `AppModule` already provides everything; no module change).

Specs in `health.service.spec.ts` (use `FakeWorkersService` for workers):

- all four combinations of `database` × `workers` map to `ok` / `degraded` / `error` / `error`;
- a throwing `DataSource.query` yields `database: 'down'` and logs once, without leaking the message into the result;
- `liveness()` and `checkReadiness()` both carry `app: 'kerghan'` and the `version` from the read file;
- an unreadable or invalid `package.json` omits the `version` key (assert with `not.toHaveProperty('version')`), logs once, and never throws;
- `liveness()` never calls `DataSource.query` or `isRunning()`.

## Files to Change

- `backend/src/health/health.service.ts` — types, version read and cache, `liveness()`, workers check, status helper
- `backend/src/health/tests/health.service.spec.ts` — the specs above
