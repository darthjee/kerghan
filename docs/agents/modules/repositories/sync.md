# Repositories — Sync

How the backend syncs GitHub into the [data model](../repositories/data-model.md). Part of the
[Repositories module](../repositories.md).

## Sources

A user's sync reads every source they have:

- **Each of their integrations** (`pat`, `oauth_app`, `github_app`), whatever its status: the
  repositories that credential can see, including private and organization ones. Requests go
  through the Integrations module ([GitHub service](../integrations/github-service/api.md#exported-service)), on the
  endpoint of its type ([endpoints](../integrations/github-service/api.md#endpoints-and-parameters)).
  - A **non-usable** integration ([usable integrations](../integrations/github-service/status-and-errors.md#usable-integrations)) is
    not called: its source records `invalid_credentials` (status `expired`, `invalid` or
    `undecryptable`) or `error` (type disabled on this server), and keeps its earlier rows and
    pages, like any [failed source](sync/write-path.md#partial-failures).
  - A **missing** integration (deleted since the run listed the user's integrations) answers
    `integration_unusable` with reason `missing`
    ([usable integrations](../integrations/github-service/status-and-errors.md#usable-integrations)). The run stops that source and
    writes nothing more for it, **no status** either, as for a handle changed mid-sync
    ([write path](sync/write-path.md#write-path)); the deletion hook and the end-of-sync safety net drop its rows.
    The reason never reaches a response.
- **The GitHub handle** ([data model](../auth/github-handle.md)): the handle's public repositories.
  - The run reads the current handle through Auth's export when it starts, after the
    [handle reconciliation](../auth/github-handle.md#handle-changes); no handle ⇒ no handle source. The handle
    it started with is the run's **handle** for the [write guard](sync/write-path.md#write-path).
  - They are fetched **through the oldest usable integration**, with that credential's own rate
    limit ([handle credential](#handle-credential)).
  - The **unauthenticated** path, which shares the backend IP's 60 requests/hour, is used only
    when no usable integration is left.
  - The handle source keeps only repos with `private = false`, even when fetched through an
    integration, so private metadata is always tied to the integration that granted it.

Results are merged by GitHub repository id; each repo records which sources returned it
([data model](../repositories/data-model.md#repositories_sources)).

### Handle credential

- The handle's public repositories go through the user's **oldest usable integration**
  (`created_at`, then `id`), the same choice as Add's access link
  ([GitHub service](../integrations/github-service/add-and-deletion.md#access-link-on-add)). **Usable** means reported status
  `active` and type enabled on this server; `expired`, `invalid` and `undecryptable` integrations
  are never handle credentials ([usable integrations](../integrations/github-service/status-and-errors.md#usable-integrations)). The
  sync takes them from `listUsableIntegrations`.
- On an **`invalid_credentials`** result (a `401`, which sets the integration `invalid`), the
  handle source **restarts from page 1 with the next usable integration**; with none left, it
  uses the unauthenticated path, under its [threshold](sync/github-limits.md#rate-limits). A `github_app` call's `401`
  that survives the token re-mint is `unavailable`, not `invalid_credentials`, so it does not
  fall back ([installation tokens](../integrations/github-service/api.md#github-app-installation-tokens)).
- On a **rate limit, timeout or `5xx`, there is no fallback**: the source is `rate_limited` /
  `error`. Falling back to the unauthenticated path would spend the budget every user shares.
- A **`404`** on the handle listing (an unknown, renamed, suspended or deleted handle) makes the
  source **`not_found`**, whatever credential served it ([error mapping](../integrations/github-service/status-and-errors.md#error-mapping)).
  - **No fallback:** a `404` is not a `401`, so no other credential is tried.
  - **Not ok for row statuses:** its rows and pages are kept, so nothing is pruned, and added repos
    it alone holds read Unknown ([data model](../repositories/data-model.md#row-statuses)). A renamed handle's repos
    still exist on GitHub under the new name.
  - **Retried on every sync:** it is not skipped like `rate_limited`.
- The source status never reveals which credential served it ([routes](../../backend/routes/repositories.md#sync-state)).
- **Endpoints** ([GitHub service](../integrations/github-service/api.md#endpoints-and-parameters)): `pat` and
  `oauth_app` sources read `GET /user/repos` (`affiliation=owner,collaborator,organization_member`,
  `visibility=all`, `sort=created&direction=asc`); `github_app` sources read
  `GET /installation/repositories` with an installation token; the handle reads
  `GET /users/{handle}/repos?type=owner&sort=created&direction=asc`, whatever the credential.


## Pages

| Page | Read when |
|---|---|
| [Trigger and execution](sync/execution.md) | You need the stale/Refresh triggers, the in-process run and `SyncLauncher`, the per-user lock and its atomic claim, the injected `Clock`, or lease/restart recovery |
| [Write path and pruning](sync/write-path.md) | You need how a source is read page by page, the per-page transaction, end of source/sync, the link fill, partial failures, or pruning |
| [GitHub limits](sync/github-limits.md) | You need rate limits and the unauthenticated budget tracker, ETag/conditional requests, the fixed network rules, the configurable values, or the [edge-case matrix](edge-cases.md) pointer |
| [Required tests](sync/required-tests.md) | You are writing or reviewing the sync's specs |
