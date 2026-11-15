# Issue: Add background workers to the backend (deku-swarm)

## Description

Add background-job ("worker") capability to the backend, built on [deku-swarm](docs/agents/external/HOW_TO_USE_DEKU_SWARM.md) (a zero-dependency, queue-based worker pool with cooldown-based retry, job chaining and dead-lettering).

This issue ships **infrastructure only**. The jobs the workers are meant for come later, each in its own issue:

- Syncing the status of issues with GitHub.
- Importing data.
- Syncing with other Kerghan instances.

The workers run **in-process**, inside the existing backend (no new service, entrypoint, container or Render service), and jobs are started by HTTP requests. They are therefore also available in the standalone distribution, which runs the same backend.

## Problem

The backend has no general way to run background work. The only background task today is the repositories sync, started as a detached promise (`DetachedSyncLauncher`), with no pool size, retry or shared lifecycle; every new background task would have to reinvent those. Upcoming features (GitHub issue-status sync, data import, syncing with other Kerghan instances) are long-running work that must not run inside a request/response cycle.

## Expected Behavior

- On boot, the backend builds a pool of workers and starts the engine; on shutdown, it stops the engine and gives in-flight jobs a bounded time to finish.
- A module can register a kind of job and enqueue one through `WorkersService` (the enqueue path is what a future HTTP endpoint will use) without touching `deku-swarm` internals.
- A failed job is retried after a cooldown, up to a retry limit, then ends `dead`.
- Pool size, cooldown, retry limit and tick interval are configurable through optional env vars with safe defaults.
- Nothing changes for existing behavior: no endpoint, table, migration or required env var is added, and the repositories sync is untouched.

## Solution

### Module and lifecycle

- A new **always-on** `Workers` module in `backend/src/workers/`, imported into `AppModule` (it must run at boot to start the engine). It exports a small `WorkersService` (direct DI, per `docs/agents/architecture/modular-pattern.md`) with `register(name, JobClass, attributes)` and `enqueue(name, params)`, so other modules never touch `deku-swarm`'s global statics (`JobFactory`, `JobRegistry`) and the registered attributes can carry injected services.
- The registries (`JobRegistry`, `WorkersRegistry`) are built with `ensureBuild` in `onModuleInit` (before the server listens); the engine (`keepAlive: true`, `idleTimeoutMs` unused) starts in `onApplicationBootstrap`. A job enqueued in between waits and is picked up on the first tick.
- A `loggerFactory` adapter routes `deku-swarm`'s worker logs to the Core `LoggerService`.
- `main.ts` must call `app.enableShutdownHooks()` (it does not today), otherwise `onApplicationShutdown` never runs on SIGTERM.

### Configuration

Read once at boot through `ConfigService`, same convention as `RepositoriesConfig`: a positive integer; unset, non-numeric, non-integer or non-positive values fall back to the default and never fail boot. All optional.

| Variable | Maps to | Default |
|---|---|---|
| `KERGHAN_WORKERS_POOL_SIZE` | `WorkersRegistry` `quantity` (concurrent jobs) | `3` |
| `KERGHAN_WORKERS_COOLDOWN_MS` | `JobRegistry` `cooldown` (wait before a failed job is retried) | `5000` |
| `KERGHAN_WORKERS_MAX_RETRIES` | `JobRegistry` `maxRetries` (a job class may override it) | `3` |
| `KERGHAN_WORKERS_SLEEP_MS` | `Engine` `sleepMs` (tick interval) | `500` |

The pool-size default is 3 because jobs are I/O-bound against GitHub and other instances, and the repositories sync already caps at `SYNC_PARALLELISM = 3`, which leaves headroom against GitHub rate limits. The other defaults are `deku-swarm`'s own. There is no enable/disable flag: specs that build a testing module without `app.init()` never start the engine, and a kill switch can be added if a use case appears. The variables are not added to `.env.dev.sample`.

### Edge cases

- **Shutdown with jobs in flight:** `Engine.stop()` ends the loop after the current tick and does not wait for busy workers. In `onApplicationShutdown` the module calls `engine.stop()`, then polls `WorkersRegistry.hasBusyWorker()` for up to a fixed drain timeout of about 10 s (a constant, not an env var). Past it, the in-flight job is lost, like any restart loss. Upstream request to drop the polling: darthjee/navi#1004.
- **Engine crash:** if `engine.start()` rejects, the module catches it, logs it at `error` with safe fields only (the error class), does not restart the engine and keeps the API up. Upstream request for observable engine status and last error: darthjee/navi#1005.
- **Dead jobs:** stay in memory in `dead` until restart; the worker logs through the adapter. Surfacing them over HTTP comes with the job-status API.
- **Unbounded growth of `finished`/`dead`:** `deku-swarm` never prunes them and `clearQueues()` also drops pending work. No leak today (no job here). Recorded in `docs/agents/future.md`; upstream request: darthjee/navi#1006.
- **Persistence and scheduling:** out of scope. Queues are in memory (a queued or running job is lost on restart) and there are no periodic jobs. Both are recorded in `docs/agents/future.md`.

### Out of scope

- Any real job, and any example or no-op job.
- Any HTTP endpoint, including a job-status API such as `GET /jobs/:id`; the first one comes with the first real job's issue (with its security review).
- Migrating the repositories sync onto the worker pool.
- A separate worker process, persistence across restarts, scheduling, and pruning of terminal jobs.

### Testing

Pure unit specs in the normal Jest tier (no DB), under `backend/src/workers/tests/`:

1. Wiring: the registries are built with the configured values; the engine runs `keepAlive`.
2. Config: each variable falls back to its default for unset, non-numeric, non-integer or non-positive values.
3. Lifecycle: the engine starts in `onApplicationBootstrap`; `onApplicationShutdown` stops it, waits for busy workers up to the drain timeout and still finishes when a worker never goes idle.
4. Engine crash: a rejected `start()` is logged (error class only), nothing is restarted, the module does not throw.
5. Double initialization: a second bootstrap using `ensureBuild` does not throw.
6. End to end: a throwaway job defined in the spec (not shipped) is registered and enqueued through `WorkersService` and runs; a failing job is retried and ends `dead`; the logger adapter output reaches `LoggerService`.

Conventions:

- A shared helper under `backend/src/workers/tests/support/` resets `JobFactory`, `JobRegistry` and `WorkersRegistry` (global singletons) in `afterEach`; it is part of this issue and future job specs reuse it.
- No real time: specs use `sleepMs: -1` and a small cooldown; the drain timeout and its poll interval are constructor or config values the specs override (the `Clock` only offers `now()`), not fake timers.
- Specs await a promise the throwaway job resolves, never a sleep, and call `onApplicationBootstrap()` / `onApplicationShutdown()` directly instead of booting a full Nest app.

### Documentation (same PR as the code)

- New `docs/agents/modules/workers.md`: purpose and use cases; the in-process model; the lifecycle; the configuration table; the edge cases; the testing conventions and reset helper; how to add a job (subclass `Job`, register it with `WorkersService.register`, enqueue with `WorkersService.enqueue`); a "Not built" list linking `future.md` and darthjee/navi#1004, #1005 and #1006; and rules for future jobs: credentials stay in the Integrations module (a job gets ids, never secrets, in its attributes), logs carry safe fields only (error class, ids), and jobs must be idempotent because the queues are in memory.
- Updated: `docs/agents/environment-variables.md` (the four rows in the backend runtime section); the module lists in `folder-structure.md` (a `src/workers/` row and the `modules/` row), `index.md`, `summary.md`, and `architecture/backend.md` and `architecture/modular-pattern.md` if they list modules; `docs/agents/standalone.md` (one line: workers run inside the standalone backend, no extra service or variables).
- Already merged or in flight: the deku-swarm entry in `external.md`, and `future.md` (darthjee/kerghan#481).

### Alternatives considered

- **`deku-swarm` (chosen):** the author's own zero-dependency pool; runs in-process with no new infrastructure.
- **BullMQ / Redis:** rejected for now; Redis is not in the stack (compose, standalone, Render), so it adds infrastructure for jobs that are not heavy.
- **MySQL-backed queue:** this is the persistence topic, deferred; it can be revisited with the first real job.
- **Detached promises (status quo, like `DetachedSyncLauncher`):** fine for one task, but with no pool, retry or shared lifecycle each new task reinvents them.

## Benefits

- One shared, tested way to run background work, instead of ad-hoc detached promises.
- Retry with cooldown and dead-lettering for the flaky, rate-limited calls to GitHub and other instances.
- No new infrastructure (compose, standalone, CircleCI and Render are untouched), and workers come to the standalone distribution for free.
- The upcoming jobs (GitHub status sync, data import, instance sync) can each be added as a small, separate issue on top of it.

## Notes

- Backward compatibility: no endpoint, table, migration or required env var is added; the only new dependency is the `deku-swarm` npm package, which must be installed through `docker-compose`, never on the host, and gets the usual dependency review.
- Performance: the pool shares the API's event loop (accepted; jobs are expected to be light and I/O-bound).
- Security: no endpoint is added, so no new attack surface; the rules for future jobs are in `workers.md`.
