# Module — Workers

Kerghan's in-process background worker pool, built on the
[`deku-swarm`](https://www.npmjs.com/package/deku-swarm) library. **Always-on** — imported
directly into `AppModule` (see `docs/agents/architecture/modular-pattern.md`), no lazy loading.
It has **no HTTP surface** (no controller, routes, DTOs, entities or migrations). Other modules
consume it through the exported `WorkersService`, injected via direct DI.

**Use cases:** work that must outlive a request but is cheap to redo, such as a GitHub
repository sync launched by a request. No job exists yet; this module only provides the pool
([#479](../issues/479-add-navi-worker-deku-swarm.md)).

## In-process model

- The pool runs **inside the backend process**; there is no separate service, container or
  queue broker, and nothing changes in compose, standalone, CI or Render.
- Queues are **in memory**. A restart (deploy, crash, SIGTERM after the drain) loses pending
  jobs. Jobs must therefore be **idempotent** and re-derivable from the database.
- `deku-swarm` keeps three global singletons (`JobFactory`, `JobRegistry`, `WorkersRegistry`).
  Only `WorkersService` touches them; other modules never import `deku-swarm`.
- The package ships no types: a minimal ambient declaration lives in
  `backend/src/types/deku-swarm.d.ts`. It is ESM-only, so `backend/jest.base.cjs` compiles it
  with swc for Jest.

## Lifecycle

`WorkersService` implements three Nest hooks:

1. `onModuleInit` — `JobRegistry.ensureBuild({ cooldown, maxRetries })`,
   `WorkersRegistry.ensureBuild({ quantity, factory })` and `WorkersRegistry.initWorkers()`.
   All idempotent, so a second call does not throw.
2. `onApplicationBootstrap` — builds the `Engine` (`keepAlive: true`, configured `sleepMs`) and
   starts it **without awaiting**. A rejecting engine is logged once as `workers engine crashed`
   (`error`, `context: 'WorkersService'`, `errorClass` only) and is **never restarted**.
3. `onApplicationShutdown` — `engine.stop()`, awaits the run promise, then polls
   `WorkersRegistry.hasBusyWorker()` every 100 ms until no worker is busy or the fixed 10 s drain
   timeout passes. On timeout it logs a `warn` (`workers drain timed out`, no job data) and
   carries on.

`main.ts` calls `app.enableShutdownHooks()`; without it the drain never runs on SIGTERM.

## `WorkersService` contract

- `register(name, JobClass, attributes?)` — registers a job class under a name
  (`JobFactory.build`). `attributes` are injected into every built job and may carry services.
- `enqueue(name, params?)` — builds a job with the registered factory, enqueues it and returns
  its id.

## Configuration

Read once at boot by `WorkersConfig` (`backend/src/workers/workers-config.ts`). An unset,
non-numeric, non-integer or non-positive value falls back to the default and never fails boot.

| Variable | Default | Meaning |
|---|---|---|
| `KERGHAN_WORKERS_POOL_SIZE` | `3` | Number of workers |
| `KERGHAN_WORKERS_COOLDOWN_MS` | `5000` | Wait before a failed job is retried |
| `KERGHAN_WORKERS_MAX_RETRIES` | `3` | Registry-level retry cap |
| `KERGHAN_WORKERS_SLEEP_MS` | `500` | Engine sleep between loop iterations |

The drain timeout (10 s) and poll interval (100 ms) are fixed constants, not env vars; they are
exposed on `WorkersConfig` so specs can override them.

## Edge cases

- **Shutdown drain** — bounded (10 s); jobs still running after that are abandoned.
- **Engine crash** — logged, never restarted; queued jobs stop being processed until a restart.
- **Dead jobs** — a job that exhausts its attempts moves to `dead` and stays in memory.
- **Unbounded growth** — `finished` and `dead` collections are never pruned; pruning is
  deferred.
- **Double initialization** — `onModuleInit` twice is safe (`ensureBuild`).
- **Job retries** — `Job#maxRetries` defaults to 3 per job; a job counts a failed attempt only
  when it calls `_fail(error)` from `perform`.
- **Event-loop starvation** — a negative `sleepMs` makes the `keepAlive` engine loop
  microtask-only and blocks timers; always use a positive `sleepMs`.

## Adding a job

1. Write a class extending `Job` with `perform(logger)`; on failure call `this._fail(error)`.
2. Import `WorkersModule` in the consuming module and inject `WorkersService`.
3. Call `register('name', JobClass, { services })` once (e.g. `onModuleInit`).
4. Call `enqueue('name', { ids })` from the service that owns the work.

## Rules for jobs

- **Credentials stay in the Integrations module.** A job receives ids, never secrets, in its
  attributes or params.
- **Logs carry safe fields only** (error class, `workerId`, `jobId`); never job attributes. The
  `loggerFactory` adapter (`workers-logger.ts`) emits `context: 'Workers'`, `workerId`, `jobId`.
- **Idempotent**, because queues are in memory.

## Testing

Unit specs under `backend/src/workers/tests/`, no database. The three `deku-swarm` singletons
are global, so every spec calls `resetDekuSwarm()`
(`tests/support/reset-deku-swarm.ts`) in `afterEach`; the same file has a throwaway
`ThrowawayJob` and a `done()` deferred promise to await instead of sleeping. Specs call the
lifecycle hooks directly and override the drain timeout through `WorkersConfig`.

## Not built

- No job, no endpoint that enqueues one.
- No persistence of queues and no scheduling (recurring jobs).
- No pruning of finished/dead jobs.
- Tracked upstream in darthjee/navi#1004, #1005 and #1006.
