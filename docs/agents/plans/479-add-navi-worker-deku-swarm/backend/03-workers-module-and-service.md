# Workers module, service and lifecycle

Create the always-on `Workers` module and import it into `AppModule`.

- `backend/src/workers/workers.module.ts` — provides `WorkersConfig` and `WorkersService`, imports `LoggingModule` (Core logger) as the other modules do, and **exports `WorkersService`** (direct DI, per `docs/agents/architecture/modular-pattern.md`).
- `backend/src/workers/workers.service.ts` — `WorkersService implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown`:
  - `onModuleInit`: `JobRegistry.ensureBuild({ cooldown, maxRetries })`; `WorkersRegistry.ensureBuild({ quantity: poolSize, factory: new WorkerFactory({ jobRegistry, workersRegistry, loggerFactory }) })`; `WorkersRegistry.initWorkers()` (idempotent).
  - `loggerFactory`: a small adapter (own file, e.g. `workers-logger.ts`) mapping `({ workerId, jobId })` to a logger exposing `debug/info/warn/error` that delegates to `LoggerService` with safe fields only (`context: 'Workers'`, `workerId`, `jobId`); never log job attributes.
  - `register(name, JobClass, attributes)` wraps `JobFactory.build(name, { klass, attributes })`; `enqueue(name, params)` wraps `JobRegistry.enqueue(name, params)` and returns the job id. Other modules never touch the `deku-swarm` statics. JSDoc states that `attributes` may carry injected services and that jobs must receive ids, never secrets.
  - `onApplicationBootstrap`: build the `Engine` (`keepAlive: true`, `sleepMs`) and start it without awaiting; keep the run promise; attach a `.catch` that logs `'workers engine crashed'` at `error` with `context: 'WorkersService'` and `errorClass` only, with no restart.
  - `onApplicationShutdown`: `engine.stop()`, await the run promise (swallowing its already-logged rejection), then poll `WorkersRegistry.hasBusyWorker()` every poll interval until none is busy or the drain timeout passes; on timeout log a `warn` (no job data) and continue.
- `backend/src/app.module.ts` — import `WorkersModule` next to the other always-on modules.
- `backend/src/main.ts` — call `app.enableShutdownHooks()` right after `NestFactory.create`, and update the bootstrap JSDoc.

Keep methods small enough for the repo's `complexity` rule; follow the class member ordering lint (`sort-class-members`).

## Files to Change
- `backend/src/workers/workers.module.ts` — new always-on module.
- `backend/src/workers/workers.service.ts` — registry setup, `register`/`enqueue`, engine lifecycle, drain, crash logging.
- `backend/src/workers/workers-logger.ts` — `loggerFactory` adapter onto `LoggerService`.
- `backend/src/app.module.ts` — import `WorkersModule`.
- `backend/src/main.ts` — `enableShutdownHooks()` and JSDoc.
