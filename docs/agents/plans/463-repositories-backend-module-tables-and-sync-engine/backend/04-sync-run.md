# Sync run: sources, pages, ETags, failures, pruning and link fill

Implement one sync run, `SyncRunner.run(userId, runId)` (`repositories/sync-runner.ts`, plus small collaborators), as specified in:
- `sync.md#sources`, `#handle-credential`, `#per-source`, `#write-path`, `#link-fill`, `#partial-failures`, `#pruning`, `#rate-limits`, `#conditional-requests`, `#restart-recovery`;
- `model.md#private-metadata-lifecycle`.

Every GitHub call goes through `IntegrationsGithubService` (imported from `integrations-github.public.ts`). Every time value comes from `Clock`.

- **Export gap (fix in Integrations).** The sync needs **all** of a user's integration ids, usable or not, for three things:
  - the non-usable sources (`sync.md#sources`);
  - the end-of-sync safety net;
  - the link fill's `:userIntegrationIds`.

  `IntegrationsGithubService` only has `listUsableIntegrations`. Add `listIntegrations(userId): Promise<IntegrationRef[]>`: every one of the user's integrations, usable or not, user-scoped, oldest first (`created_at`, then `id`), with the same allowlisted `IntegrationRef` fields as `listUsableIntegrations` and nothing else. Step 06's listing also needs it, for the `uuid` / `label` of non-usable sources. Also:
  - add it to `FakeIntegrationsGithubService` (`setIntegrations`, logged as a non-GitHub call) and to the fake-fidelity contract spec (`integrations-github.contract.spec.ts`);
  - document it in `integrations.md#exported-service` (step 08).

  A non-usable integration's source is then answered by `listRepositories` with `integration_unusable`, reason `status` (store `invalid_credentials`) or `type_disabled` (store `error`). Reason `missing` stops that source with **no status**.
- **Start of run:**
  1. Run `HandleReconciler.forRun(userId)`; with no sync-state row, stop.
  2. Read the run's handle (the current, normalised handle); with no handle there is no handle source.
  3. Load the integration ids and the usable list.
  4. Compute the sources, and skip any `rate_limited` source whose stored `resetAt` is still in the future (no call; status, `resetAt` and rows are kept).
- **Parallelism and deadline:** up to 3 sources at once, with each source's pages sequential. Check the hard deadline (5 min from the claim's `last_started_at`, per `Clock`) between pages; past it, stop and store `error` for every source cut short.
- **Per source**, page by page up to the page cap (`KERGHAN_REPOSITORIES_SYNC_PAGE_CAP`):
  - Send the stored `etag`, except on the last stored page (`has_next = false`), which is requested without `If-None-Match`.
  - Request page `N + 1` only while `hasNext`.
  - Make the GitHub call **before** opening the page transaction.
  - **Handle source:**
    - Use the oldest usable integration first. On `invalid_credentials`, restart from page 1 with the next usable one, then unauthenticated (`integrationId = null`).
    - A rate limit, `unavailable` (timeout, `5xx`, redirect) or `not_found` never falls back.
    - Drop private repos before writing.
  - **Page transaction (`200`):**
    1. Run the run-guarded heartbeat. The handle source adds `AND handle <=> :runHandle`. Zero rows with `run_id` still ours means the handle changed: stop the handle source only, writing no status. Otherwise zero rows means the run lost its lease or its row: roll back and stop the run.
    2. Multi-row `INSERT … ON DUPLICATE KEY UPDATE owner, name, private, last_seen_at, updated_at`. It never touches `added_at` or `integration_id`.
    3. Re-select the ids by `github_id IN (…)`.
    4. Delete the `handle` source row of any repo the upsert turned private.
    5. Rewrite this page's source rows.
    6. Upsert the page row (`etag`, `has_next`, `fetched_at`).
  - **`304`:** in a guarded transaction, keep the page's source rows and set their repos' `last_seen_at`; the stored `has_next` decides whether to continue.
  - **End of source** (guarded, every delete `AND user_id`):
    - success: delete the source and page rows past the last page, and store `ok`;
    - page cap: the same past the cap, and store `page_cap_reached`;
    - failure: store only the status (`invalid_credentials`, `rate_limited` with `reset_at`, `not_found` for the handle, `error` otherwise);
    - `missing` or a mid-sync handle change: write nothing.
- **End of sync** (one guarded transaction, in this order):
  1. the safety net: drop the source, page and status rows of any `integration:<id>` key whose id is not in `listIntegrations`;
  2. the link fill (`sync.md#link-fill`; skipped with no usable integration; never overwrites an existing link);
  3. the prune (`Pruner`, the single-table `DELETE … NOT EXISTS` of `model.md`, shared with the reconciler and the listeners);
  4. `finish` (`idle`, `last_synced_at = now`), even when every source failed.
- **Catch-all:** the task the launcher runs wraps `run` and always calls the run-guarded `release` on an unexpected exception, logging safe fields only (`userId`, error class).
- **Status read model:** `RowStatus` derivation (Added / Not added / Unavailable / Unknown) lives in a pure function over a repo row, its source rows and the source statuses (`model.md#row-statuses`): `page_cap_reached` counts as ok, `pending` (no status row) as not ok, and a dangling `integration_id` reads empty. Step 06's listing uses it.
- **Static check:** `repositories/tests/no-sql-now.spec.ts` scans `src/repositories/**` (excluding `tests/`) and fails on `NOW()` or `CURRENT_TIMESTAMP` `(static)`.
- **Tests** (`(db)` unless tagged; one spec file per concern), covering every item of `sync.md#required-tests` under "Sources", "Write path", "Link fill", "Conditional requests and pagination", "Pruning", "Rate limits", "Integration deletion" and the hard deadline, plus the "Row statuses" and "Pruning and deletion" (pruning) items of `model.md#required-tests`. The row-status rules also get `(unit)` table specs on the pure function. Use the shared builders (`integrations/tests/support/github-builders.ts`) for fake answers, and the two-user baseline so the intruder's rows stay untouched.

## Files to Change
- `backend/src/integrations/integrations-github.service.ts`, `integrations-github.public.ts`: add `listIntegrations`.
- `backend/src/integrations/tests/support/fake-integrations-github.service.ts`, `tests/integrations-github.contract.spec.ts`, `tests/integrations-github.service.spec.ts`: fake, fidelity and unit coverage of `listIntegrations`.
- `backend/src/repositories/sync-runner.ts`, `source-runner.ts` (or similar), `page-writer.ts`, `pruner.ts`, `link-filler.ts`, `row-status.ts`: new.
- `backend/src/repositories/tests/*.db-spec.ts`, `row-status.spec.ts`, `no-sql-now.spec.ts`: new.
