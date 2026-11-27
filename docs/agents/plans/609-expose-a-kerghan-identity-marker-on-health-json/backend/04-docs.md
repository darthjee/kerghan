# Update the backend and security docs

- `docs/agents/architecture/backend/request-pipeline.md`, "Health probes": update the table to the new bodies (`app`, `version`, `checks.workers`, the `degraded` row at `200`, `503` only for `error`). Keep the "touches no dependency" sentence for liveness, and add that `version` is read once at boot from `package.json` and omitted when unreadable. Describe the status derivation and the meaning of `workers` (the engine is running; a crash or shutdown is `down`; queue depth is not health). Note that `status: "down"` and `"unknown"` are reserved for the Tent fallback in #613.
- `docs/agents/modules/workers.md`: document `isRunning()` in the exported surface, and record the `health` → `workers` dependency and why it is acceptable (read-only, one boolean, no job data).
- `docs/agents/architecture/security.md`, "Rules for future changes" (the `GET` routes bullet): the probes expose only `app`, `status`, `version` and per-check `up`/`down` states. The release semver is public by design (open-source repo, README, image tags), and no host, error, stack or credential is ever exposed. Mention that Tent's `Server` / `X-Powered-By` headers are out of scope here.

## Files to Change

- `docs/agents/architecture/backend/request-pipeline.md` — probe table and semantics
- `docs/agents/modules/workers.md` — `isRunning()` and the new consumer
- `docs/agents/architecture/security.md` — probe exposure note
