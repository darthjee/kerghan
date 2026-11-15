# Specs and the reset helper

Unit specs only (normal Jest tier, no DB) under `backend/src/workers/tests/`, in the style of the existing module specs.

- Helper `backend/src/workers/tests/support/reset-deku-swarm.ts`: a function that calls `JobFactory.reset()`, `JobRegistry.reset()` and `WorkersRegistry.reset()`, used in `afterEach` of every spec (the three are global singletons). Add a small throwaway job class and a deferred-promise helper (`done`) for specs to await, never a sleep.
- `workers-config.spec.ts`: each variable falls back to its default for unset, non-numeric, non-integer, zero and negative values, and a valid value is used.
- `workers.service.spec.ts`:
  1. Wiring: registries built with the configured pool size, cooldown, max retries; engine built `keepAlive: true` with the configured sleep.
  2. Lifecycle: `onApplicationBootstrap` starts the engine; `onApplicationShutdown` stops it and waits for a busy worker, finishing as soon as it goes idle; with a worker that never goes idle it finishes after the (overridden, tiny) drain timeout and logs a `warn`.
  3. Engine crash: a rejecting `start()` is logged with the error class only (assert no message/job data), nothing is restarted, and shutdown still completes.
  4. Double initialization: calling `onModuleInit` twice does not throw.
  5. End to end through `WorkersService`: register a throwaway job, enqueue it, await its `done` promise; a job that always fails is retried (use `sleepMs: -1` and a tiny cooldown) and ends in `dead`; the `loggerFactory` output reaches a fake `LoggerService`.
- Call `onModuleInit()`, `onApplicationBootstrap()` and `onApplicationShutdown()` directly on the service; do not boot a full Nest app. Override the drain timeout and poll interval through the constructor/config; no fake timers.
- Check that `main.ts` calls `enableShutdownHooks` if there is an existing way to test `bootstrap`; otherwise cover it by review (it is a one-line change).

## Files to Change
- `backend/src/workers/tests/support/reset-deku-swarm.ts` — singleton reset helper plus throwaway job and `done` helper.
- `backend/src/workers/tests/workers-config.spec.ts` — config specs.
- `backend/src/workers/tests/workers.service.spec.ts` — wiring, lifecycle, crash, double-init and end-to-end specs.
