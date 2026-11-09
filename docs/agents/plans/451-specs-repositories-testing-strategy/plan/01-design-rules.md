# Design rules in their owning files

Record the implementation rules that the testing strategy depends on, in the files that own them, before `testing.md` cites them.

- **`sync.md`:**
  - **Injected `Clock` (`now(): Date`).** It is the only time source of the Repositories module. Every time rule reads it:
    - the TTL, the Refresh cooldown, the lease and its heartbeat, the hard deadline;
    - `resetAt` checks;
    - the Add rate-limit window.
  - **No `NOW()` / `CURRENT_TIMESTAMP`.** Every SQL time condition (lease expiry, TTL, cooldown, heartbeat) compares against an app-supplied timestamp parameter from the `Clock`. Put this near the claim and lease rules, and in "Values" if that reads better.
  - **Injected `SyncLauncher`.** Its `launch(task)` detaches the run and catches its errors. It is the only way a sync is started (stale trigger and Refresh). Put this in "Execution".
- **`model.md`:** cite the `Clock` rule where `last_started_at`, `last_synced_at`, `last_seen_at`, the lease or the timestamps are set. Do not restate it.
- **`integrations.md`:** the installation-token cache (expiry − 5 min) and the unauthenticated budget tracker (reset window) read the injected `Clock`.
- **`security.md`:** a short "Module boundaries" item under "Credentials stay in the backend". It states that the boundary is enforced by:
  - an ESLint override on `backend/src/repositories/**`, which allows only the exported Integrations/Auth entry points and bans `fetch`;
  - a static spec, which scans for `auth_users` / `integrations` table names, `secret_iv` and `NOW(`, and checks the allowlist of the exported result types' keys.
  - It links to `testing.md`.

## Files to Change

- `docs/agents/specs/repos/sync.md` — the `Clock`, no-`NOW()` and `SyncLauncher` rules.
- `docs/agents/specs/repos/model.md` — cite the `Clock` rule.
- `docs/agents/specs/repos/integrations.md` — the token cache and budget tracker read the `Clock`.
- `docs/agents/specs/repos/security.md` — the module-boundary enforcement item.
