# Repositories

Listing a logged-in user's GitHub repositories and adding them to Kerghan. Product decision: #444.

## Overview

Kerghan's core value is per-user repo tracking ([product.md](../product.md),
[flow.md](../flow.md) steps 2–3). The **Repositories** module lets a user see their GitHub
repositories and add them to Kerghan:

- A **Repositories** page lists the user's GitHub repositories. The listing **merges** every
  source the user has: each of their [integrations](integrations/github-service.md), plus the public
  repositories of an optional [GitHub handle](auth/github-handle.md) stored on their account.
  Duplicates are merged by GitHub repository id.
- Each row is **Added**, **Not added**, **Unavailable** (added, but no source returns it any more)
  or **Unknown** (added, but its only sources failed or have not been synced yet).
- Not-added rows have an **Add** button that adds the repo to Kerghan for that user.
- Every GitHub call happens in the **backend**, inside the Integrations module
  ([credentials stay in the backend](../architecture/security.md#github-credentials-stay-in-the-backend)).
  The frontend only talks to Kerghan's API.
- Everything is **user-scoped**: a user sees and manages only their own repositories.

It is the foundation for later per-repo features (issues, label rules, "needs attention"), which
are not built yet.

### Not built

- Removing a repo from Kerghan once added.
- Adding a repo by `owner/name` that is not in the user's own listing.
- Listing or fetching issues, label rules, "needs attention" triage.
- Org-wide tracking (one entry following every repo of an org).
- Scheduled or background sync, polling GitHub. Syncs run only on demand.
- Changing an added repo's existing access link after Add. A private repo whose linked
  integration was deleted reads Unavailable only until the next sync fills its empty or dangling
  link with a usable integration that returned the repo ([link fill](repositories/sync/write-path.md#link-fill));
  an existing link is never changed.
- An environment variable to set the GitHub handle.

### Module boundaries and ownership

The module owns five tables and every row belongs to exactly one user. It reads the integrations
only through `IntegrationsGithubService` ([GitHub service](integrations/github-service.md)) and
the handle only through Auth's `AccountHandleService` ([GitHub handle](auth/github-handle.md#auth-export)).

### Lookups exported to Issues

`RepositoriesService` answers the Issues module's repository questions; nothing here calls GitHub
and every query is scoped by `user_id`:

- `resolveForProject(userId, ref)`: the internal id, whether the row is added, and its summary.
- `projectSummaries(userId, repositoryIds)`: the summaries of a page of projects' rows in one set of queries.
- `integrationSourceIds(userId, repositoryId)`: the ids of the user's integrations whose source lists
  the row, from the `integration:<id>` rows of `repositories_sources` (one indexed query, ascending).
  A `handle` source is never returned, because a handle alone is not a credential candidate (E20).
  Issues intersects it with the usable integrations and orders the result
  ([integration selection](../specs/issues/sync.md#integration-selection)).

## Index

| Doc | Read this when |
|---|---|
| [Data model](repositories/data-model.md) | You need the tables, `source_key`, row statuses, logical FKs, user deletion, the private-metadata lifecycle and pruning rule, or ownership |
| [Security](repositories/security.md) | You touch module boundaries, user scoping, Add verification, retention, the handle, the fixed GitHub base URL, CSRF, errors or abuse limits |
| [Frontend](repositories/frontend.md) | You build or change the Repositories page: table, toolbar, sync UX, source errors, empty state, handle field, UI edge cases |
| [Sync](repositories/sync.md) | Sources and the handle's credential, trigger (stale / Refresh), in-process execution and the injected `SyncLauncher`, per-user lock, the injected `Clock`, lease recovery, pagination, write path, partial failures, pruning, rate limits, ETags, values |
| [Edge cases](repositories/edge-cases.md) | The edge-case matrix: every case, its outcome and the rule behind it |
| [Testing](repositories/testing.md) | You pick a test tier, mock GitHub, or detach sync and time in tests |
| [Testing coverage](repositories/testing-coverage.md) | You need the concurrency, access-control, module-boundary, frontend and cache test expectations, or where tests live |
| [Required tests](repositories/required-tests.md) | You need the required model, security and UI tests |
| [Routes — Repositories](../backend/routes/repositories.md) | Routes, request/response contract, repo ref, sync state and polling, errors, access rules, Add rate limit |
| [Integrations — GitHub service](integrations/github-service.md) | `IntegrationsGithubService`, the GitHub client, endpoints per source, installation-token cache, `401 → invalid`, `integration.deleted` |
| [Auth — GitHub handle](auth/github-handle.md) | `auth_users.github_handle`, `AccountHandleService`, handle changes, the default user |
