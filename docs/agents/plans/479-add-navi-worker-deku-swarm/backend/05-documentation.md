# Documentation

Ships in the same PR as the code, so the docs describe what is merged. These files live in `docs/agents/`, outside `backend/`; the backend agent writes them here as part of the change (the architect reviews).

- New `docs/agents/modules/workers.md`, modelled on `modules/mail.md` and `modules/repositories.md`: purpose and use cases; the in-process model; the lifecycle (`onModuleInit` / `onApplicationBootstrap` / `onApplicationShutdown`); the `WorkersService` contract (`register`, `enqueue`); the configuration table; the edge cases (shutdown drain, engine crash, dead jobs, unbounded growth, double initialization); the testing conventions and the reset helper; how to add a job; a "Not built" list (no job, no endpoint, no persistence, no scheduling) linking `future.md` and darthjee/navi#1004, #1005 and #1006; and the rules for future jobs: credentials stay in the Integrations module (a job gets ids, never secrets, in its attributes), logs carry safe fields only (error class, ids), and jobs must be idempotent because queues are in memory.
- `docs/agents/environment-variables.md`: the four `KERGHAN_WORKERS_*` rows in section 1 (Consumed, optional, with defaults and `backend/src/workers/workers-config.ts` as the source). Not added to `.env.dev.sample`.
- Module lists: `docs/agents/folder-structure.md` (a `src/workers/` row, and the `modules/` row), `docs/agents/index.md`, `docs/agents/summary.md`, and `docs/agents/architecture/backend.md` and `architecture/modular-pattern.md` where they list always-on modules.
- `docs/agents/standalone.md`: one line saying workers run inside the standalone backend with no extra service or variables (defaults apply).
- `docs/agents/architecture/security.md` is not changed (no endpoint); the job rules live in `workers.md`.

## Files to Change
- `docs/agents/modules/workers.md` — new module doc.
- `docs/agents/environment-variables.md` — four new rows.
- `docs/agents/folder-structure.md` — `src/workers/` and `modules/` rows.
- `docs/agents/index.md` and `docs/agents/summary.md` — link and abstract for `workers.md`.
- `docs/agents/architecture/backend.md` and `docs/agents/architecture/modular-pattern.md` — module lists.
- `docs/agents/standalone.md` — one line on workers in the standalone backend.
