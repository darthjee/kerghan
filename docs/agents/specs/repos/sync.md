# Repositories — Sync

How the backend syncs GitHub into the [data model](model.md). Part of the
[Repositories specs](README.md).

## Sources

A user's sync reads every source they have:

- **Each of their integrations** (`pat`, `oauth_app`, `github_app`): the repositories that
  credential can see, including private and organization ones. Requests go through the
  Integrations module ([integrations.md](integrations.md#exported-service)).
- **The GitHub handle** ([model.md](model.md#github-handle)): the handle's public repositories.
  - When the user has a **valid integration**, they are fetched **through it**, with that
    credential's own rate limit.
  - Only a user with no valid integration uses the **unauthenticated** path, which shares the
    backend IP's 60 requests/hour.
  - The handle source keeps only repos with `private = false`, even when fetched through an
    integration, so private metadata is always tied to the integration that granted it.

Results are merged by GitHub repository id; each repo records which sources returned it
([model.md](model.md#sources-table)).

> **Open — settled by #448:** the GitHub endpoint and parameters per integration type (e.g.
> `/user/repos` vs `/installation/repositories`), and for the handle.

## Trigger

- **Stale:** opening the listing starts a sync when the user's last sync is older than a TTL.
- **Refresh:** the Refresh action forces a sync, subject to a **cooldown**; a Refresh inside it
  is refused (`429` with `Retry-After`, see [api.md](api.md#refresh)).
- **One sync per user at a time:** a trigger while a sync runs does not start a second one.
- No scheduled job, no background polling of GitHub.

## Execution

The sync is **asynchronous**: the request that triggers it does not wait for GitHub.

- The listing returns the stored rows immediately, with the sync state (`idle` / `syncing`,
  `last_synced_at`, per-source status).
- The frontend polls the sync state until it is `idle`, then reloads the page of rows
  ([ui.md](ui.md#sync-ux)).

> **Open — settled by #447:** in-process vs queue execution, behaviour on backend restart
> mid-sync, and the per-user lock mechanism.

## Per source

For each source, the sync:

1. follows every GitHub page, up to a **page cap**;
2. upserts rows by `github_id`, refreshing `owner`, `name` and `private`;
3. rewrites that source's rows in the sources table;
4. sets `last_seen_at` on the rows it returned;
5. stores the source's status: ok, error, invalid credentials, rate limited, or page cap
   reached ([model.md](model.md#sync-state)).

Not-added repos that no source returns any more are pruned
([model.md](model.md#private-metadata-lifecycle)).

## Partial failures

- A failing source (401, timeout, rate limit, other error) **does not fail the sync**; the other
  sources are still applied.
- A failed source's rows are **kept as they were** (its added repos read as Unknown, not
  Unavailable — [model.md](model.md#row-statuses)).
- A `401` on an integration sets it to `invalid`, through the Integrations module
  ([integrations.md](integrations.md#invalid-on-401)).
- Hitting the page cap is reported as the source's status; rows already read are applied.

## Rate limits

- Every GitHub response's `X-RateLimit-Remaining` / `X-RateLimit-Reset` are read.
- The **unauthenticated** source stops early when the remaining budget is low, is marked
  **rate limited** with its reset time, and keeps its stored rows.

## Conditional requests

- Each source page's `ETag` is stored and sent back as `If-None-Match`.
- A `304` reuses the stored data for that page and does not count against GitHub's limit.
- This applies to every source, authenticated or not.

## Network

- The base URL is fixed: `https://api.github.com` ([security.md](security.md#fixed-github-base-url)).
- Every GitHub call has a timeout, and one sync bounds how many GitHub calls run in parallel.
- Pagination never follows a `Link` URL whose origin is not exactly `https://api.github.com`;
  redirects to another origin are not followed, and `Authorization` never leaves that origin
  ([security.md](security.md#fixed-github-base-url)).

## Values

> **Open — settled by #447:** the TTL, the Refresh cooldown, the page cap, the rate-limit
> threshold, the timeout and the parallelism bound.

## Edge cases

> **Open — settled by #450:** the full edge-case matrix (renames and transfers, a repo seen
> through several sources, source failure vs disappearance, integration deleted mid-sync, handle
> changed, visibility flips, page cap reached, concurrent syncs, an integration's credential
> replaced with the same or a different `github_login`).

## Required tests

Tests for the open points above are added by the issue that settles them.

- Opening the listing with a stale sync starts one; with a fresh sync it does not.
- Refresh forces a sync; a Refresh inside the cooldown is refused.
- The triggering request returns stored rows and the sync state without waiting for GitHub.
- A trigger while a sync runs does not start a second one, and concurrent triggers never
  duplicate rows.
- A failing source does not fail the sync: other sources are applied, its rows are kept, and its
  status is stored.
- A `401` from an integration sets it `invalid`.
- A `304` reuses stored data.
- The unauthenticated source stops when the budget is low and is marked rate limited.
- The handle's repos go through a valid integration when one exists; unauthenticated only
  otherwise.
- Reaching the page cap stops the source and reports it.
- No GitHub call goes to a host other than `https://api.github.com`, including through `Link`
  headers and redirects.
- The handle source never stores a private repo, even when fetched through an integration.
