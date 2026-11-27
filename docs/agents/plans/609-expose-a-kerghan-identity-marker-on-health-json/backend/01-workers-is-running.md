# Add `WorkersService#isRunning()`

`/ready.json` needs to know whether the in-process worker engine is actually running. Today `WorkersService` starts the engine in `onApplicationBootstrap`, keeps its promise in `#run`, logs a crash in the `.catch` and never restarts the engine. A "registered and not shutting down" check would read `up` for a dead pool.

Add a private running flag (for example `#running = false`) and a public `isRunning(): boolean`:

- `onApplicationBootstrap`: set `#running = true` right after `engine.start()` is called. Chain a `.finally` (or set the flag in both the resolve and the existing `catch` paths) so that `#running = false` once `#run` settles, whether through a crash or a clean exit.
- `onApplicationShutdown`: set `#running = false` **first**, before `engine.stop()`, so a probe during the bounded drain reads `down`.
- Before bootstrap: `false`.

Do not expose the engine, the registries or any job data. The accessor is read-only.

Extend `FakeWorkersService` (`tests/support/fake-workers.service.ts`) with an `isRunning()` that returns a settable value (default `true`), and widen `WorkersSurface` to include `isRunning`, so health specs can drive it.

Specs in `workers.service.spec.ts`: `false` before bootstrap; `true` after `onApplicationBootstrap`; `false` after the engine promise rejects (crash, with the existing error log still emitted once) and after it resolves; `false` from the start of `onApplicationShutdown`, before the drain completes. Reuse `tests/support/reset-deku-swarm.ts` between cases.

## Files to Change

- `backend/src/workers/workers.service.ts` — `#running` state and `isRunning()`
- `backend/src/workers/tests/workers.service.spec.ts` — lifecycle specs for `isRunning()`
- `backend/src/workers/tests/support/fake-workers.service.ts` — `isRunning()` on the fake, `WorkersSurface` widened
- `backend/src/workers/tests/fake-workers.service.spec.ts` — cover the fake's `isRunning()` default and override
