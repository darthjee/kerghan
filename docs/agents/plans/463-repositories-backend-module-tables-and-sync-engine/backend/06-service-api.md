# Service API for #464

Expose `RepositoriesService` (exported by `RepositoriesModule`) as the only surface #464's controller calls. It uses typed inputs and outputs, no HTTP types and no DTO classes (#464 owns validation). Every method takes `userId` from the caller (the session) and scopes every query by it (`model.md#ownership`).

- **`list(userId, { page, perPage, filter, search })`** (`api.md#listing`):
  - `filter` is `all | added | not_added | unavailable`;
  - `search` is a trimmed literal substring on `owner/name`, bound as a parameter with `%`, `_` and `\` escaped (`ESCAPE '\\'`);
  - the sort is fixed: case-insensitive `owner`, then `name`, then `github_id`;
  - it returns the rows with their derived `status` (step 04's `row-status.ts`), their current `sources` (integration `uuid` / `label` from `listIntegrations`, the handle from `repositories_sync_states.handle`), the access integration (`null` when empty or dangling), and `total` / `totalPages` for the filtered set;
  - the filter must apply before pagination, so derive the status in SQL (`CASE` with `EXISTS` subqueries over `repositories_sources` and `repositories_source_statuses`, bound to the user's current integration ids), with the pure function as the reference implementation that the `(unit)` specs pin;
  - it never calls GitHub: only `listIntegrations`, which reads the DB;
  - it never exposes the internal `id` in its result type.
- **`syncState(userId)`** (`api.md#sync-state`): `idle` or `syncing` (a dead lease reads `idle`), `startedAt`, `lastSyncedAt`, `refreshAvailableAt` (from `last_started_at` + cooldown), and per-source statuses keyed like the listing's `sources`, with `pending` for a current source with no status row. A stored `invalid_credentials` of an integration that is usable again (its credential was replaced) reads `pending` (`api.md#sync-state`); this read is derivation, so it lives here, and #464 only shapes the response. It never starts a sync.
- **Triggers:**
  - `triggerIfStale(userId)` (listing) and `refresh(userId)` (Refresh) run `ensureRow` (step 03, user-exists check), then `HandleReconciler.forRequest`, then `claim`;
  - on `started`, they hand `SyncRunner.run` to the `SyncLauncher` and return immediately;
  - they return the claim outcome (`started` / `running` / `cooldown` with `lastStartedAt` / `fresh`), so #464 can answer `202` / `429` with `Retry-After`.
- **`reconcileForRequest(userId)`:** the entry-point reconciliation, for routes that start no sync (the sync-state route, Add).
- **`findByRef(userId, { githubId } | { fullName })`** (`api.md#repo-ref`): own rows only. `fullName` matches `owner/name` case-insensitively; a tie breaks on the latest `last_seen_at`, then the highest `id`. It returns what Add needs (the internal id stays inside the service), or `null` (#464 answers `404`).
- **`markAdded(userId, repoRef, integrationId | null)`:** the conditional `UPDATE … SET added_at = :now, integration_id = :integrationId WHERE id = :id AND user_id = :userId AND added_at IS NULL`. It returns `added`, `already_added` (re-read: `added_at` set) or `gone` (row pruned, so #464 answers `404`).
- **Tests:**
  - `(db)`: filters, search (including literal `%` / `_` / `\`), the stable sort, pagination totals, a page past the end, sources and the access integration (a dangling link reads `null`), and the sync-state read (including a dead lease and `pending`);
  - `(db)` + `CapturingLauncher`: the trigger returns before the captured task runs and the fake logs no GitHub call; after `runAll()` the effects are visible;
  - `(db)`: the `fullName` tie-break; `markAdded`'s three outcomes; pruning-vs-Add in both orders (`model.md#private-metadata-lifecycle`);
  - `(db)` concurrency (type a): a double `markAdded` writes once;
  - the sync half of `security.md#required-tests` "User scoping": with the two-user baseline, no method, sync, listener or reconciliation reads or changes the intruder's rows.

## Files to Change
- `backend/src/repositories/repositories.service.ts`: new; the API above.
- `backend/src/repositories/repositories-listing.query.ts` (or similar): new; the listing SQL.
- `backend/src/repositories/types/*.ts`: new; the typed inputs and outputs.
- `backend/src/repositories/tests/repositories.service.*.db-spec.ts`, `user-scoping.db-spec.ts`: new.
