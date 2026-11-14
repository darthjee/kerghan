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
  link with a usable integration that returned the repo ([link fill](repositories/sync.md#link-fill));
  an existing link is never changed.
- An environment variable to set the GitHub handle.

### Module boundaries and ownership

The module owns five tables and every row belongs to exactly one user. It reads the integrations
only through `IntegrationsGithubService` ([GitHub service](integrations/github-service.md)) and
the handle only through Auth's `AccountHandleService` ([GitHub handle](auth/github-handle.md#auth-export)).

## Data model

The data owned by the Repositories module, plus one column owned by Auth
([`github_handle`](auth/github-handle.md)).

### Tables

The Repositories module owns five tables, under its own prefix
([modular pattern](../architecture/modular-pattern.md#database-strategy)).

**Conventions** follow `integrations`: `int` auto-increment `id`, plain `int` `user_id` (no
relation, logical FK), explicit `varchar` lengths, `datetime`, index names
`idx_<table>_<cols>`, unique or not (`isUnique: true`), as in `integrations`. MySQL's default
`utf8mb4_0900_ai_ci` collation gives the case-insensitive `fullName` lookup ([routes](../backend/routes/repositories.md#repo-ref)).

**Source key:** every per-source row identifies its source with `source_key varchar(32)`:
`integration:<id>` or `handle`. Not a nullable `integration_id` (MySQL unique indexes allow
several `NULL`s) nor a `0` sentinel.

| Table | Columns | Indexes |
|---|---|---|
| `repositories` | `id`; `user_id int`; `github_id bigint`; `owner varchar(39)`; `name varchar(100)`; `private boolean`; `added_at datetime NULL`; `integration_id int NULL`; `last_seen_at datetime`; `created_at`, `updated_at` | unique (`user_id`, `github_id`); (`user_id`, `added_at`); (`user_id`, `owner`, `name`); (`user_id`, `integration_id`) |
| `repositories_sources` | `id`; `user_id int`; `repository_id int`; `source_key`; `page smallint` | unique (`repository_id`, `source_key`); (`user_id`, `source_key`, `page`) |
| `repositories_source_pages` | `id`; `user_id int`; `source_key`; `page smallint`; `etag varchar(255) NULL` (no `If-None-Match` sent when null); `has_next boolean`; `fetched_at datetime` | unique (`user_id`, `source_key`, `page`) |
| `repositories_sync_states` | `user_id int` **primary key** (one row per user: the exception to the auto-increment `id` convention); `state varchar(16)`; `run_id char(36) NULL`; `last_started_at datetime NULL`; `heartbeat_at datetime NULL`; `last_synced_at datetime NULL`; `handle varchar(39) NULL`; `created_at`, `updated_at` | primary key (`user_id`) |
| `repositories_source_statuses` | `id`; `user_id int`; `source_key`; `status varchar(32)`; `synced_at datetime`; `reset_at datetime NULL` | unique (`user_id`, `source_key`) |

- Search (`LIKE '%…%'`) scans, bounded to one user's rows.
- Every query of these tables is scoped by `user_id` from the session
  ([ownership](#ownership)).

#### `repositories`

One row per (user, GitHub repository) **seen in a sync**. There is no separate "remote repo"
entity: the same row is the persisted snapshot of the GitHub repo and records whether the user
added it.

| Column | Meaning |
|---|---|
| `id` | Internal primary key. |
| `user_id` | Owner. Logical FK to `auth_users.id`. |
| `github_id` | GitHub's numeric repository id. The stable key. `bigint`, mapped to a JS number through a column transformer (`from: Number`), since TypeORM's MySQL driver returns `bigint` as a string by default. GitHub ids will pass 2³¹ but stay far below 2⁵³. |
| `owner` | Last known owner login (`varchar(39)`, GitHub's limit). |
| `name` | Last known repository name (`varchar(100)`, GitHub's limit). |
| `private` | Last known visibility. |
| `added_at` | Nullable. Set when the user adds the repo; `null` means not added. |
| `integration_id` | Nullable. The access link, set on Add ([GitHub service](integrations/github-service.md#access-link-on-add)). Logical FK to `integrations.id`. Empty for a repo added through the public source only. |
| `last_seen_at` | When a source page last returned the repo (`200` or `304`), even if that source failed on a later page. Informational: no status derives from it ([sync](repositories/sync.md#write-path)). |
| `created_at`, `updated_at` | Timestamps. |

- **Unique** on (`user_id`, `github_id`): a user has at most one row per GitHub repo.
- **Renames and transfers are followed through `github_id`:** each sync refreshes `owner`,
  `name` and `private` (`INSERT … ON DUPLICATE KEY UPDATE`, which never touches `added_at` or
  `integration_id`).
- Indexes: (`user_id`, `added_at`) for the listing filters, (`user_id`, `owner`, `name`) for the
  sort and `fullName` lookup, (`user_id`, `integration_id`) for the deletion hook.

#### `repositories_sources`

Which sources returned each repo, as of each source's **last applied page**, and on which page:
one row per (repository, `source_key`). A failed or interrupted source keeps its earlier rows
([sync](repositories/sync.md#partial-failures)).

- `user_id` is denormalised, for per-user/per-source cleanup without a join.
- `page` records what each page contained, so a `304` keeps that page's rows and a successful
  source deletes the rows past its last page ([sync](repositories/sync.md#write-path)).
- It drives the per-row source badges ([frontend](#table)), the access-link choice on Add, the
  row statuses and [pruning](#private-metadata-lifecycle).

#### `repositories_source_pages`

One row per (user, source, page): the page's `etag`, whether it had a next page (`has_next`) and
`fetched_at`. Used for conditional requests ([sync](repositories/sync.md#conditional-requests)); never
shared between users.

#### `repositories_sync_states`

One row per user, keyed by `user_id`, created on first use with
`INSERT … ON DUPLICATE KEY UPDATE user_id = user_id` ([sync](repositories/sync.md#per-user-lock)):

- `state`: `idle` or `syncing`;
- `run_id`: the running sync's UUID, `null` when idle; every write of a run is guarded by it;
- `last_started_at`: set by every claim, **never cleared**: the cooldown anchor; the API's
  `startedAt` while syncing and `refreshAvailableAt` derive from it ([routes](../backend/routes/repositories.md#sync-state));
- `heartbeat_at`: bumped after every GitHub page; a `syncing` row whose heartbeat is older than
  the lease reads as `idle` ([sync](repositories/sync.md#restart-recovery));
- `last_synced_at`: end of the last finished sync;
- `handle`: the GitHub handle the stored `handle` source rows belong to (normalised, `null` when
  none); written only by the [handle reconciliation](auth/github-handle.md#handle-changes), never by a sync run.

It survives across requests, so staleness and partial failures are known on every listing. The
lock and its claim are defined in [sync](repositories/sync.md#per-user-lock).

Every timestamp of these tables (`last_started_at`, `heartbeat_at`, `last_synced_at`,
`last_seen_at`, `synced_at`, `added_at`, the lease) is set and compared from the injected
`Clock`, never `NOW()` in SQL ([sync](repositories/sync.md#time-source)).

#### `repositories_source_statuses`

The **per-source status** of the latest run of each source, one row per (user, `source_key`):
**ok**, **error**, **invalid credentials**, **rate limited** (with `reset_at`), **page cap
reached**, **not found** (`not_found`, handle source only: the handle listing answered `404`,
[sync](repositories/sync.md#handle-credential)), and `synced_at`.

- A current source with no row (added since the last sync) reads `pending`
  ([routes](../backend/routes/repositories.md#sync-state)).
- A table, not JSON on the sync state: each source writes its status in its own transaction, and
  the deletion hook drops one row.


### Row statuses

Derived from stored data on read, never stored as a column:

| Status | Rule |
|---|---|
| **Added** | `added_at` is set, it has at least one source row from a source whose latest status is `ok` or `page_cap_reached`, and it is not unavailable under the private-link rule below. |
| **Not added** | `added_at` is `null`. |
| **Unavailable** | `added_at` is set, and either it has **no source row left** (every source that returned it later succeeded without returning it: deleted, renamed out of reach, access lost, or its only access integration deleted), or it is **private** and its `integration_id` is empty or dangling (its linked integration was deleted, #444). A public repo whose link was cleared stays available through the unauthenticated path. |
| **Unknown** | `added_at` is set, and every source row it has belongs to a source that is not ok: its latest status is a failure (`error`, `invalid_credentials`, `rate_limited`, `not_found`), or it has no status row yet (`pending`, for example a first run interrupted after it applied pages). |

Statuses are read from `repositories_sources` together with `repositories_source_statuses`,
over the user's **current** sources only (every integration, usable or not, and the stored
handle): a leftover row of a deleted integration, before the
[safety net](repositories/sync.md#write-path) drops it, never makes a repo Added or holds it available. A
failed source never makes a repo unavailable: its rows are kept as they were
([sync](repositories/sync.md#partial-failures)).

- **`page_cap_reached` counts as `ok`:** every row it holds within the cap was just returned, and
  its rows past the cap are trimmed ([sync](repositories/sync.md#write-path)).
- **`pending` counts as not ok:** a source with rows but no status row (its first run was
  interrupted) cannot vouch for them.
- **An empty link is refilled:** an added private repo with an empty or dangling
  `integration_id` reads Unavailable only until the next sync's [link fill](repositories/sync.md#link-fill)
  gives it a usable integration that returns it; it then reads Added again.

### Logical foreign keys

`user_id` → `auth_users` and `integration_id` → `integrations` are **logical** FKs only: no
physical constraint, no cross-module JOIN ([modular pattern](../architecture/modular-pattern.md#database-strategy)).
The `integrations.user_id` cascade remains the project's only physical cross-module FK.

Consequences:

- **Integration deleted:** the Repositories module is told, then drops that integration's source,
  page and status rows, clears `integration_id` wherever it points at it, and
  [prunes](#private-metadata-lifecycle) ([GitHub service](integrations/github-service.md#deletion-hook)).
  The hook receives the owning `user_id` with the integration id, and every statement in it
  (the `integration_id` clear, the deletes by `source_key = 'integration:<id>'`, the pruning)
  includes `AND user_id = :userId`. Reads treat a dangling `integration_id` as empty.
- **User deleted:** the user's repositories, sources and sync state must not outlive them
  ([user deletion](#user-deletion)).

- **Hook mechanism:** an awaited `integration.deleted` event (`IntegrationDeletedEvent { userId,
  integrationId }`), emitted by the Integrations service with `emitAsync` **after the delete
  commits**; Repositories' listener runs the cleanup above in one transaction. A listener failure
  is logged and never blocks the delete (`204` stands); the end-of-sync
  [safety net](repositories/sync.md#write-path) drops the rows of any integration no longer among the user's
  ([GitHub service](integrations/github-service.md#deletion-hook)). A direct call would make the two modules
  import each other.

#### User deletion

No user-deletion path exists today. This is the Repositories contract for when one does.

- **Event:** the deletion path emits an awaited **`user.deleted`** event
  (`UserDeletedEvent { userId }`, exported with the `USER_DELETED` name by
  `auth/events/user-deleted.event.ts`) with `emitAsync`, **after the user row delete commits**:
  the same pattern as `integration.deleted`. Nothing emits it yet; Repositories only listens.
- **Listener:** Repositories' listener, registered at boot like the `integration.deleted` one,
  runs one transaction that deletes the user's rows from all five tables: `repositories`,
  `repositories_sources`, `repositories_source_pages`, `repositories_source_statuses` and
  `repositories_sync_states`. Every statement has `WHERE user_id = :userId`. Its first statement
  locks the user's sync-state row (`SELECT … FOR UPDATE`), the lock order every multi-table Repositories
  write transaction follows ([sync](repositories/sync.md#write-path)), so it serializes with a running sync's
  page writes instead of deadlocking with them.
- **Best-effort:** a listener failure is logged **at error level** with safe fields (`userId`,
  error class), so the rows can be purged, and never blocks the deletion. A future deletion
  path must retry the event or run an orphan sweep (see [Auth](auth.md#userdeleted-event)).
- **No row created for a deleted user:** a request entry point creates the sync-state row only
  if the user still exists, re-read through Auth's export
  ([Auth export](auth/github-handle.md#auth-export), `lockExistingUser`) in the same transaction, so a request that
  passed `JwtGuard` before the delete committed creates no orphan. The shared lock closes the
  race: while the entry point holds it, the user row delete waits for its commit (and the
  `user.deleted` listener then deletes the new row); once the delete committed, the read finds
  no user and nothing is created.
- **A running sync:** the deleted sync-state row makes the run's next `run_id`-guarded write
  affect no row, so the run rolls back and stops; a run never recreates the row
  ([handle changes](auth/github-handle.md#handle-changes), [sync](repositories/sync.md#write-path)).
- **Why not a physical cascade:** it keeps logical FKs only, so `integrations.user_id` stays the
  project's only physical cross-module FK. Orphans left by a failed listener are visible to no
  one: under normal operation MySQL 8 never reuses an auto-increment `id`, so no future user can
  inherit them. A backup restore or a manual `AUTO_INCREMENT` reset could reuse one, which is why
  the deletion path retries the event or sweeps orphans. The risk is retention, not exposure.
- **Integrations cascade:** the user's integrations go through their own `ON DELETE CASCADE`,
  which emits no `integration.deleted`. The `user.deleted` listener covers their Repositories
  rows anyway.

### Private metadata lifecycle

Private repositories' metadata is kept only while a source can still see it:

- When an integration is deleted, its source rows go and the access link is cleared.
- **Not-added** repos left with no source are **deleted**.
- **Added** repos stay, shown **unavailable**, so the user's choice is not lost.
- The same rule applies when a sync of a source succeeds without returning a repo.

**Pruning rule:** a not-added repo (`added_at IS NULL`) is deleted when **no source row** points
at it. Nothing else is checked: a successful source has already dropped the rows it no longer
returns (page rewrites, cleanup past its last page), and a failed, interrupted or capped source
keeps its rows, so a failure blocks pruning by construction.

```sql
DELETE FROM repositories
WHERE user_id = :userId AND added_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM repositories_sources s
    WHERE s.user_id = :userId AND s.repository_id = repositories.id
  )
```

The single-table form is what TypeORM's `.delete()` query builder can produce; the unique
(`repository_id`, `source_key`) index covers the subquery.

- **When:** at the end of each sync, in its final `run_id`-guarded transaction
  ([sync](repositories/sync.md#pruning)); and after changes that orphan rows outside a sync: an
  integration's source rows dropped by the [deletion hook](#logical-foreign-keys) (the `integration.deleted` event), and the handle changed or cleared (its source, page and status rows dropped by the
  [handle reconciliation](auth/github-handle.md#handle-changes) on the next Repositories request, so a new handle reads
  `pending`).
- **Race with Add:** pruning deletes only `added_at IS NULL` rows, and Add's write is
  `UPDATE … WHERE id = :id AND user_id = :userId AND added_at IS NULL` ([routes](../backend/routes/repositories.md#add)).
  Add commits first ⇒ the row is skipped;
  pruning first ⇒ Add's update affects no row and Add answers `404 NOT_FOUND` (the repo left the
  listing, [routes](../backend/routes/repositories.md#add)). Every other case is in the [edge-case matrix](repositories/edge-cases.md).
- Rejected: a grace period before pruning. Private metadata would outlive access, against #444's
  lifecycle rule; failed sources are already protected by keeping their rows.

### Ownership

- Every row belongs to exactly one Kerghan user, set from the session, never from the request.
- Two users who see or add the same GitHub repo get two independent rows; nothing is shared.


## Security

Security and abuse rules of the Repositories module. The cross-cutting rule that GitHub
credentials stay in the backend is in
[Security](../architecture/security.md#github-credentials-stay-in-the-backend).

### Module boundaries

The boundary is enforced by tooling, not left to review alone
([Testing](#module-boundary-tests)):

- **ESLint override on `backend/src/repositories/**`:** `no-restricted-imports` allows Integrations
  and Auth only through their exported entry points (`IntegrationsGithubService` and its typed
  results, `AccountHandleService`, the `integration.deleted` / `user.deleted` event types) and
  refuses their entities, the encryption service and the GitHub client; `no-restricted-globals`
  bans `fetch`, since Repositories holds no HTTP code.
- **Static boundary spec:** scans the Repositories sources (tests excluded) for the
  `auth_users` / `integrations` table names, `secret_iv`, and `NOW(` / `CURRENT_TIMESTAMP`;
  asserts that no Repositories entity maps those tables; and checks the exported
  `IntegrationsGithubService` result types against a fixed allowlist of keys, so no credential
  field can be added to them.
- Both are added by the first implementation sub-issue that needs them. The security and
  data-access reviews still apply to every implementation PR.


### User scoping

- Every query is filtered by the session's user id **in the query itself** (`… AND user_id = ?`),
  never by loading a row and comparing afterwards.
- Another user's repository answers `404` identical to a missing one: same status, code and
  message.
- No response, error code or message reveals that another user holds or added the same GitHub
  repository.
- Add looks up the caller's own row before any GitHub call ([routes](../backend/routes/repositories.md#add)).
- No response exposes `user_id` or an internal `integrations.id` ([routes](../backend/routes/repositories.md#access)).
- Admins have no access to anyone's repositories (same rule as integrations), and the existing
  admin endpoints (`/admin/users/*`) carry no repository-derived field (counts, flags, names,
  sync state).
- Every endpoint requires `JwtGuard` and sends `X-Skip-Cache` ([routes](../backend/routes/repositories.md#every-route)).
- **Accepted cross-user signal:** the unauthenticated GitHub budget (60/h) is shared by every
  user of the backend IP, so its state is visible to a user as a `rate_limited` source status
  with its `resetAt`, and as Add's `503 GITHUB_RATE_LIMITED`. That `resetAt` may also hint that a
  handle source went unauthenticated. Both are accepted; nothing else about other users'
  activity is exposed.
- **Accepted shared-budget starvation:** the unauthenticated budget has no per-user share. One
  user with no usable integration (or a few accounts) can spend it down to the sync threshold,
  leaving other users' unauthenticated sources `rate_limited` until the reset; Adds keep the
  reserve below it, but repeated Adds can still drain it and make other users' unauthenticated
  Adds answer `503`. Bounded by the Refresh cooldown, the page cap, the per-user Add rate limit
  and the thresholds; accepted for now
  ([sync](repositories/sync.md#rate-limits)). A per-user cap would need its own decision.

### Add verification

Add only accepts a repository already in the caller's own listing, and is verified with GitHub
([routes](../backend/routes/repositories.md#add)), so a user cannot add a repository, or learn its metadata, by guessing a
GitHub repository id or an `owner/name`.

- The [repo ref](../backend/routes/repositories.md#repo-ref) is `{ githubId }` or `{ fullName }`; a `fullName` resolves
  only among the caller's own rows, so it cannot reach a repo outside the listing.
- Check order: per-user rate limit → own-rows lookup → GitHub re-check. The rate limit comes
  first, so every attempt counts and probing is bounded.
- Every `404` carries the same code and message (`Repository not found`), whether the ref is
  absent, held only by another user, or denied by GitHub.
- `409 REPOSITORY_SOURCE_UNUSABLE` (no usable candidate before any GitHub call) is decided after
  the rate limit and the own-rows lookup, only from the caller's own sources, so it reveals
  nothing about other users or about GitHub and adds no probing surface.
- The GitHub re-check is built from the stored row, never from the request's `fullName`; an
  unlinked re-check that finds the repo private links the granting integration, so private
  metadata stays tied to it ([routes](../backend/routes/repositories.md#add)).
- The rate limit is **30 Adds per 60 s** per user by default, configurable
  ([routes](../backend/routes/repositories.md#add-rate-limit)). The unauthenticated re-check honours **Add's own
  threshold** (refused at remaining ≤ 0; the sync stops at ≤ 10), and each Add makes at most 3
  GitHub calls ([candidate walk](integrations/github-service.md#add-re-check-candidates)).


### Private metadata and retention

Private metadata is kept only while a source can still see it, except for added repos, kept as
unavailable ([data model](#private-metadata-lifecycle)). The handle source keeps only
public repos, so private metadata is always tied to the integration that granted it
([sync](repositories/sync.md#sources)); when a sync turns a repo private, its `handle` source row is
dropped, so a stale handle row never keeps it alive ([sync](repositories/sync.md#write-path)).

- A capped source deletes its rows past the cap, so a lowered cap never keeps private metadata
  past any check ([sync](repositories/sync.md#write-path)).
- The end-of-sync [link fill](repositories/sync.md#link-fill) ties an added private repo with an empty or
  dangling link back to a usable integration that returns it.
- Rows of non-usable integrations are kept until the integration is fixed or deleted, visible
  only to their owner ([GitHub service](integrations/github-service.md#usable-integrations)).
- A deleted user's rows are removed by the `user.deleted` listener; orphans left by a failed
  listener are visible to no one under normal operation, since an auto-increment `id` is not
  reused; the deletion path retries the event or sweeps orphans for the cases where one could be
  (backup restore, `AUTO_INCREMENT` reset): retention, not exposure
  ([data model](#user-deletion)).
- The handle source status `not_found` only says that a public GitHub login does not exist.


### GitHub handle

Column, normalisation, validation and edit path: [data model](#github-handle).

- **Validated before storage**, after normalisation (trim, one leading `@` stripped, lowercase):
  `^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$` (letters, digits, single hyphens, no leading or
  trailing hyphen, at most 39 characters). Anything else answers `400` and stores nothing.
- **URL-encoded** (`encodeURIComponent`) whenever it goes into a GitHub path, so it cannot alter
  the path even if the format rule were ever loosened.
- **No uniqueness:** two users may hold the same handle, so saving a handle never reveals that
  another user holds it.
- **Handle-only edits need no current password** and stay outside the account-edit abuse guard:
  the handle is public, non-credential data, so re-authentication would protect nothing. The
  password is never checked on that path, so it is no password oracle, and it cannot change a
  credential, the username or the email. A request that also carries a managed field
  (`username`, `email`, `newPassword`) takes the full existing path: `currentPassword`, lockout,
  abuse guard.
- **Default user:** the `409 DEFAULT_USER_MANAGED` block narrows to the managed fields, by
  presence. A handle-only edit passes; a mixed edit is refused whole. The block still runs before
  the lockout and the password check, so the managed password stays unguessable through
  `account.json`.
- **Admins** neither see nor edit the handle: `/admin/users/*` responses and the admin edit
  contract are unchanged (consistent with [user scoping](#user-scoping)).
- **`POST /auth/account/mine.json`** returns only the session's own `{ username, email,
  githubHandle }`: no id in the request, `X-Skip-Cache`, `POST` so `OriginGuard` covers it.
- **Handle changes** drop the old handle's rows on the next Repositories request
  ([data model](auth/github-handle.md#handle-changes)); the handle source holds only public repos, so the lag
  exposes no private metadata.

### Fixed GitHub base URL

The backend only ever calls `https://api.github.com`. No user input chooses the host or a path
outside the endpoints this feature uses, so there is no SSRF surface.

A single client, in the Integrations module, makes every GitHub call of the feature, with or
without a credential ([unauthenticated calls](integrations/github-service.md#unauthenticated-calls)); without
one it sends no `Authorization` header. Server-supplied URLs are never requested:

- pagination builds its own page URLs (`?per_page=100&page=N`) and reads `Link` only to know
  whether `rel="next"` exists; it never requests a URL taken from a response
  ([sync](repositories/sync.md#per-source));
- **no redirect is followed**, same-origin or not (the repo operations use `redirect: 'manual'`, and
  classifies any `3xx` other than `304` as `unavailable` (`redirect`)): a `Location` is a
  response-supplied URL. Any such `3xx` makes a sync source `error` and
  Add answer `502 GITHUB_UNAVAILABLE`, and `Authorization` is never sent to another host.

Repository links in the UI are built by the frontend from `owner` and `name`
([frontend](#table)); a GitHub-supplied URL is never rendered.

### CSRF

Every route is `POST`, reads included, so `OriginGuard` covers all four
([architecture/security.md](../architecture/security.md#csrf)). The listing's stale-sync
trigger is therefore not a state change over `GET`, and needs no exception
([routes](../backend/routes/repositories.md#stale-sync-trigger)).

### Errors and logging

- Exact codes and messages: the [error table](../backend/routes/repositories.md#errors) in `api.md`.
- Sync failures never become HTTP errors: they surface only as the per-source `status` of the
  [sync state](../backend/routes/repositories.md#sync-state), which the UI maps to fixed banner texts.
- GitHub error bodies and messages are never echoed to the client, nor any credential detail;
  anything unexpected is `500 INTERNAL_ERROR`.
- Credentials never appear in logs or error responses.

### Abuse and performance

- One sync per user at a time (an atomic claim with a lease), a Refresh cooldown, a per-source
  page cap, a hard deadline per sync, and an early stop of the unauthenticated source on a low
  rate-limit budget, tracked process-wide and shared with Add ([sync](repositories/sync.md#values)). The
  tracker reserves each granted call before it is sent, so parallel sources and concurrent Adds
  never overshoot the budget ([sync](repositories/sync.md#rate-limits)).
- Timeouts and a parallelism bound on GitHub calls.
- A sync that lost its lease cannot write: every write is guarded by its `run_id`
  ([sync](repositories/sync.md#restart-recovery)).


## Frontend

The frontend of the Repositories feature. Part of the Repositories module.

Conventions to follow: hash routes in `frontend/assets/js/utils/routing/HashRouteResolver.js`,
the navbar in `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`, and the
Integrations page under `frontend/assets/js/components/resources/accounts/pages/` for the table
layout.

The frontend never calls GitHub for this feature: it only talks to Kerghan's API
([routes](../backend/routes/repositories.md)).

### Placement

A top-level **Repositories** link in the navbar, to `#/repositories`, shown to every logged-in
user and hidden while the account awaits approval, like the rest of the logged-in menu.
Repositories are the core product, not an account setting.

### Table

One row per repository:

- `owner/name`, linking to the repository on GitHub. The frontend builds the link as
  `https://github.com/` + URL-encoded `owner` + `/` + URL-encoded `name`; it never renders a
  GitHub-supplied URL;
- a visibility badge (public / private);
- source badges from the row's `sources[]`: the integration label, or the GitHub handle. Each
  badge is matched by key with the sync state's `sources[].status`
  ([routes](../backend/routes/repositories.md#listing)). The badge of a source that is not `ok` (or `page_cap_reached`) is
  shown **muted**, with the tooltip and accessible label **"<source> could not be refreshed"**;
  a `pending` source's badge reads **"<source> has not been synced yet"**;
- the status: **Added**, **Not added**, **Unavailable** or **Unknown**
  ([data model](#row-statuses));
- on not-added rows, an **Add** button (sending the row's `githubId`): a spinner while the
  request runs, the row turns **Added** on success, an inline error on failure.

Inline Add errors, shown on the row ([routes](../backend/routes/repositories.md#add)):

| Answer | Message |
|---|---|
| `404` | "Repository not found on GitHub." |
| `502` / `503` | "GitHub is unavailable or rate limited — try again later." |
| `409` `REPOSITORY_SOURCE_UNUSABLE` | "Fix the integration that sees this repository in Integrations." (link to `#/account/integrations`) |
| `429` | "Too many repositories added — try again in N s." (N from `retryAfterSeconds`) |

### Toolbar

- A filter: **All** (default), **Added**, **Not added**, **Unavailable**. **Unknown** rows show
  only under All, on purpose (the list fixed by #444).
- A name search.
- A **Refresh** button.
- A "last synced X ago" label.
- Pagination controls under the table, driven by the paginated listing.

### Sync UX

- Stored rows show immediately, with a "Syncing with GitHub…" indicator while a sync runs.
- Only the very first sync (`lastSyncedAt` is `null`) shows a full spinner.
- **Polling** ([routes](../backend/routes/repositories.md#polling-contract)): while `state` is `syncing`, the page polls
  `POST /repositories/sync/state.json` every **2 s** (a frontend constant,
  [sync](repositories/sync.md#values)). It stops on `idle` (then reloads the
  current listing page), on unmount, or on `401`; a transient error (network, `5xx`) keeps
  polling.
- **Refresh button:**
  - while syncing, it is disabled and reads "Syncing…";
  - inside the cooldown (`refreshAvailableAt` in the future), it is disabled, with the tooltip
    and accessible label **"Refresh available in 2m 34s"**, counting down from
    `refreshAvailableAt`; it re-enables at zero;
  - on a `429` anyway (race, clock skew), an inline notice **"Repositories were synced recently.
    Try again in N s."** from `retryAfterSeconds`, and the countdown adopts it.

### Source errors

A dismissible banner per source whose `status` is not `ok` or `pending`
([routes](../backend/routes/repositories.md#sync-state)). `<source>` is *integration "work-pat"* or *GitHub handle
"darthjee"*.

| Status | Banner |
|---|---|
| `invalid_credentials` | `<source>` failed: invalid credentials. **Fix it in Integrations** (link to `#/account/integrations`) |
| `rate_limited` | `<source>` hit GitHub's rate limit; it will retry after `<resetAt, local time>`. |
| `page_cap_reached` | `<source>` has more repositories than Kerghan reads; some may be missing. |
| `not_found` | GitHub handle "darthjee" was not found on GitHub. **Check it on your Account page** (link to `#/account/my-account`) |
| `error` | `<source>` could not be read from GitHub; its repositories may be out of date. |

- The handle source never links to Integrations.
- **Only integration sources show the `invalid_credentials` banner.** The handle source cannot
  read `invalid_credentials`: after a `401` it falls back to the next usable integration, then to
  the unauthenticated call, which cannot get a `401` ([sync](repositories/sync.md#handle-credential)).
- **`not_found`** is a handle-source status only.
- A fixed integration reads `pending` ([routes](../backend/routes/repositories.md#sync-state)), so its banner disappears
  at the next poll or reload after a Test or a Replace.

### Empty state

- **No source:** with no GitHub handle and no integration, the page explains both options and
  links to **Account** (`#/account/my-account`, to set the handle) and **Integrations**.
- **Sources but no repos:** with at least one source and a finished sync that found no
  repository, the page shows **"No repositories found. Check the sources above."**, distinct
  from the no-source state.
- **No match:** when a filter or a search matches nothing, the table shows **"No repositories
  match your filters."**

### GitHub handle field

A new **GitHub handle** section on the existing Account page (`#/account/my-account`), separate
from the username / email / password form, with its own input and **Save** button
([data model](#github-handle)).

- **Prefill:** on load the page calls `POST /auth/account/mine.json` and fills the input with
  `githubHandle` (empty when `null`). While it loads, the section's input and button are
  disabled; if it fails, the section shows "Could not load your GitHub handle." and stays
  disabled. The username / email / password form is unchanged (still not prefilled).
- **Help text:** "Your public GitHub repositories are listed on the Repositories page. Leave
  empty to remove it."
- **Save** sends `PATCH /auth/account.json` with only `{ githubHandle }`: the trimmed value, or
  `null` when empty. No current-password field in this section, so it works for the default user
  (who usually cannot know its password); the main form never sends `githubHandle`, so the two
  never mix.
- **Client-side validation** mirrors the server's after the same normalisation (trim, one
  leading `@`, lowercase): an invalid value shows the inline field error **"Use letters, digits
  and single hyphens (max 39 characters)."** and sends nothing.
- **Server errors** show as the section's own submit alert with `error.message` (the existing
  `FormFieldsHelper` pattern); a `401` follows the app's usual session handling.
- **Success:** the input takes the response's `githubHandle` (so `@DarthJee` shows as
  `darthjee`), with "GitHub handle updated." or, when cleared, "GitHub handle removed.".
- **Admin pages** (`#/admin/users`, `#/admin/users/:id/edit`) are unchanged: no handle column, no
  handle field.


### UI edge cases

| Case | Rule |
|---|---|
| Page emptied by the reload after a sync (on page 3, the total shrank) | If the reload returns no items on a page above 1, jump to the last page (from `total`) and reload once. |
| Row changes status during a sync | Rows stay as loaded until the reload when the sync goes idle; no row updates while syncing. |
| Add in flight, or its result, when the reload lands | Add state (spinner, inline error) is kept by `githubId` across the reload; cleared on success or on navigation. |
| Added under the "Not added" filter | The row turns Added and stays visible until the next reload or filter change, so the list does not jump under the cursor. |
| Add on a row pruned meanwhile | The `404` inline error shows; the row disappears on the next reload. |
| Handle source and `invalid_credentials` | Cannot happen ([source errors](#source-errors)); only integration sources show that banner. |
| Dismissed banners | Dismissal is kept **in memory** (no `localStorage`) per (source, status, `syncedAt`). The banner comes back when a new sync stores a failure again, or on a page reload. |
| Integration deleted while the page is open | Its badges and banner disappear at the next reload (`sources[]` drops it). |
| Sources exist but the sync found no repos | The "No repositories found" [empty state](#empty-state), distinct from the no-source one. |
| Filter or search with no matches | "No repositories match your filters." ([empty state](#empty-state)). |

Every Repositories edge case, with its outcome and its rule, is listed in the
[edge-case matrix](repositories/edge-cases.md#ui).

## Testing

How the Repositories feature is tested: tiers, fakes, harnesses and the checks enforced by
tooling. Part of the Repositories module.

What to test lives in the "Required tests" section of each rule's owning file; this page says
**how**. No test of the feature calls the real GitHub, reads the wall clock or loops to catch a
race.

### Tiers

| Tier | Files | What it runs on |
|---|---|---|
| **Unit** | `*.spec.ts` | Services and helpers with injected fakes; no app boot. |
| **E2E with fakes** | `*.e2e-spec.ts` | The Nest app over HTTP, with the in-memory repository fake (`auth/tests/support/in-memory-repo.ts`) and the [GitHub fakes](#github-mocking). |
| **DB-backed** | `*.db-spec.ts` | A real MySQL 8 database, for the SQL semantics the fakes cannot prove ([below](#db-backed-tier)). |
| **Static** | `*.spec.ts` that scans sources | Source and metadata checks, no app boot and no database ([module boundaries](#module-boundaries)). |
| **Frontend** | Jasmine specs under `frontend/specs/` | The client, controllers and rendering ([frontend](#frontend)). |

#### DB-backed tier

The in-memory fake cannot prove atomic claims, unique keys, transactions, compare-and-set,
conditional writes or `bigint` round trips, so a **narrow** tier runs them on real MySQL
(`mysql:8.4.11`, production's version):

- **Suffix:** `*.db-spec.ts`, excluded from the default `yarn test` run.
- **Runner:** a separate Jest config (`jest.db.config.ts`) and script, `yarn test:db`. It runs
  **serially**, on a dedicated test schema: the migrations run once per run, loaded from the
  TypeScript sources, and every table except `migrations` is truncated before each test.
- **Guard:** the tier refuses to start unless `KERGHAN_MYSQL_NAME` ends in `_test`, so it can
  never truncate dev or production data.
- **Locally:** through docker-compose, against the throwaway `kerghan_mysql_test` service, run
  through `kerghan_db_tests` (`make db-tests`). Never on the host.
- **CI:** its own job, `backend_db_tests`, with a `mysql:8.4.11` service container; the release
  and deploy jobs require it, like `backend_tests`.
- **Who added it:** #462 added the job, the script, the helpers and the docs (see
  [architecture/backend.md](../architecture/backend.md#testing)).
- **Existing specs are unchanged:** the other modules keep their fakes, and the Integrations
  migration specs keep the fake query runner.

### Default tier by category

Each rule category has a **default tier**. An item in a "Required tests" section runs on its
category's default tier unless it carries an exception tag.

| Category | Default tier |
|---|---|
| Atomic sync claim (conditional `UPDATE`, affected-row count), first-use sync-state row with no duplicates, `run_id`-guarded writes, unique keys (`user_id` + `github_id`, `source_key` rows), per-page transactions (a later page fails, applied pages kept), the `secret_iv` compare-and-set (its call-flow logic is also unit-tested in #461; the DB-backed spec lands with #463), Add's conditional `added_at IS NULL` write, pruning / integration-deletion / `user.deleted` queries (with two users' rows), `github_id` above 2³¹ (`bigint`), the Repositories migrations up and down | **DB-backed** |
| Routes, DTOs, guards, cache headers, error mapping to HTTP answers | **E2E with fakes** |
| Service flow (sync orchestration, source handling, row statuses, handle reconciliation flow, Add flow) | **Unit**, or **E2E with fakes** when the HTTP answer is asserted |
| The Integrations GitHub client and `IntegrationsGithubService` (requests, headers, error mapping, budget tracker, token cache) | **Unit**, at the `fetch` level |
| Module boundaries, forbidden tokens, cache-policy coverage | **Static** |
| The Repositories page, its navbar link and the Account handle section | **Frontend** |

**Exception tags** go at the end of an item only when its tier would otherwise be misread: its
tier differs from its category's default, or it is a DB-backed, static or race item in a list
whose other items run on another tier (for example the concurrent Adds among `api.md`'s e2e
items). Untagged items run on their category's default tier.

| Tag | Meaning |
|---|---|
| `(db)` | Runs on the DB-backed tier. |
| `(e2e)` | Runs as an e2e spec with fakes. |
| `(unit)` | Runs as a unit spec. |
| `(static)` | A source-scanning or metadata spec. |
| `(race)` | A scripted-interleaving race spec, type (b) of [races](#concurrency-and-races). |

### GitHub mocking

Two layers, one per module. No test of the feature calls the real GitHub.

#### Integrations: fetch level

The single GitHub client and `IntegrationsGithubService` are tested by spying on
`globalThis.fetch`, following `integrations/tests/github-client.service.spec.ts`. These specs
prove the request and its handling:

- the URL and parameters (`per_page=100&page=N`, `type=owner`, `sort=created`);
- `Authorization`, or no header at all for unauthenticated calls;
- `If-None-Match`;
- `redirect: 'manual'`;
- rate-limit header parsing and the budget tracker;
- installation-token minting and caching;
- the [error mapping](integrations/github-service.md#error-mapping) table.

#### Repositories: typed fake

Every Repositories spec (unit, e2e and DB) injects a scriptable
**`FakeIntegrationsGithubService`**. It returns the exported typed results and never touches
`fetch`, since Repositories holds no HTTP code. It ships with the Integrations module's test
support (`integrations/tests/support/fake-integrations-github.service.ts`, #461), next to the
shared builders, so the fidelity contract spec guards it; Repositories imports it.

- **Integrations:** `setUsable(userId, refs)` sets what `listUsableIntegrations` answers and
  `setIntegrations(userId, refs)` what `listIntegrations` answers (by default, the usable list).
  Both are logged as non-GitHub calls.
- **Scripting:** answers are scripted per (`integrationId` or `null`, operation, page).
- **Call log:** every call is logged, so specs assert call counts and order, including "no
  GitHub call".
- **Deferred answers:** an answer can be held on a deferred promise, for
  [race specs](#concurrency-and-races).

#### Shared builders

Typed test-support builders, no recorded JSON (`integrations/tests/support/github-builders.ts`):

- `githubRepo({ id, private, owner, name })`, with default ids above 2³¹;
- `listingPage(page, repos, { hasNext, etag })`;
- `repository(repo)` (a `GET /repositories/{id}` answer);
- `notModified()`, `rateLimited(resetAt)`, `unauthorized()`, `forbidden()`, `notFound()`,
  `timeout()`, `serverError()`, `redirect()`, `integrationUnusable(reason)`.

Integrations specs turn a builder into a raw GitHub response (body, `ETag`, `Link`,
`X-RateLimit-*` headers); the fake returns the matching typed result.

#### Fake fidelity

An Integrations **contract spec** runs each builder case through the real service at the
`fetch` level and asserts that the typed result equals what the fake returns for the same
builder, so the fake cannot drift from the real service.

#### No-network guard

The Repositories and Integrations GitHub test harnesses replace `globalThis.fetch`, before each
test, with a function that throws unless the spec mocks it
(`integrations/tests/support/no-network-guard.ts`). Other modules' specs are untouched.

### Detached sync and time

The rules are in [sync](repositories/sync.md#execution) (`SyncLauncher`) and
[sync](repositories/sync.md#time-source) (`Clock`, no `NOW()` in SQL).

**`CapturingLauncher`.** Tests replace the injected `SyncLauncher` with one that records tasks
without running them. A spec can then prove both halves of a trigger:

- the triggering request answered with the stored rows and the sync state, and the fake logged
  no GitHub call;
- after `await launcher.runAll()` (which runs the captured tasks and resolves once they
  settle), the run's effects are visible.

Race specs can also run a captured task step by step, together with the fake's deferred answers.

**`FakeClock`.** Tests replace the injected `Clock` (`core/clock.ts`) with the shared
`FakeClock` (`core/tests/support/fake-clock.ts`), exposing `set(date)` and `advance(ms)`, and
drive every time rule with it:

- the TTL, the Refresh cooldown, the lease and its heartbeat, the hard deadline;
- the `resetAt` of a `rate_limited` source and the budget tracker's reset window;
- the installation-token expiry minus 5 min;
- the Add rate-limit window.

Since no SQL time condition uses `NOW()`, the DB tier is driven by the same clock.

`jest.useFakeTimers` stays only for the per-call HTTP timeout in the Integrations `fetch`-level
specs, following the existing convention.

### Concurrency and races

Two kinds of race test. Production code gets **no test-only hooks**.

**(a) True parallelism, on the DB tier.**

- Cases: the atomic claim (two triggers start exactly one sync; the claim is refused inside the
  cooldown or while another run holds an unexpired lease); first-use creation of the sync-state
  row; concurrent handle reconciliation, which happens once; a double Add, which writes once and
  answers `200` twice.
- Each fires N operations at once with `Promise.all` on separate pool connections, then asserts
  the **invariants**: exactly one claim, one row, one write, and the expected answers. Invariants
  do not depend on which interleaving happened, so they do not flake.
- No repeat loops.

**(b) Scripted interleaving, deterministic (tag `(race)`).**

- The only pause points are GitHub calls (a deferred answer of `FakeIntegrationsGithubService`)
  and the `CapturingLauncher`.
- A spec pauses the run at a GitHub call, performs the competing action, releases the answer,
  then asserts.
- Competing actions:
  - delete the integration;
  - replace its credential (the `secret_iv` compare-and-set);
  - change the handle;
  - Add the repo;
  - delete the user;
  - advance the `FakeClock` past the lease and start run B (zombie writes, lock release by
    `run_id`);
  - pass the hard deadline.
- "A page written after the deletion hook's cleanup" is the paused page answer released after
  the deletion: that is how the end-of-sync safety net is tested.

**Integrations-level races** (installation-token single-flight, concurrent budget acquires never
overshooting) use deferred `fetch` replies in the `fetch`-level specs.

The cross-module scenarios of [edge cases](repositories/edge-cases.md#required-tests) are type (b) specs.

### Access control and leaks

#### Route access matrix

One **table-driven e2e spec**, following `integrations/tests/integrations.controller.access.e2e-spec.ts`.

- **Routes:** the four Repositories routes, `POST /auth/account/mine.json`, and the handle path of
  `PATCH /auth/account.json`.
- **Rules checked on every row:**
  - `401 UNAUTHORIZED` without a session;
  - rejected by `OriginGuard` from a foreign origin;
  - `X-Skip-Cache` is sent;
  - for repo-ref routes, a foreign repo answers a body identical to a missing one (timestamp
    ignored);
  - an admin session gets no access to another user's repositories;
  - `/admin/users/*` carries no repository-derived field and no `githubHandle`.
- **Completeness:** the spec compares its table with the controllers' registered routes, read
  from Nest metadata; a Repositories route missing from the table fails the spec.

#### Credential canary sweep

Reuses the existing `CANARY_*` pattern of the Integrations specs.

- **Canaries seeded:** a PAT, an OAuth token, a GitHub App private key, a minted installation
  token, and a GitHub error body/message.
- **Flow exercised:** a sync with every source status; the listing and the sync state; Add's
  success and every Add error (`404`, `409`, `429`, `502`, `503`).
- **Assertion:** no response body, response header or captured log line contains any canary.
- The `fetch`-level Integrations specs also assert that `Authorization` is never sent off
  `https://api.github.com` and that installation tokens are minted with `metadata: read` only.

#### Two-user baseline

Every Repositories e2e and DB harness seeds an **intruder** user holding a row with the same
`github_id` and an integration of its own. Every spec can therefore assert that the intruder's
rows are untouched and never returned, on top of the dedicated scoping specs.

### Module-boundary tests

The rules are in [security](#module-boundaries). Both checks are added by the first
implementation sub-issue that needs them.

- **ESLint override** on `backend/src/repositories/**`: `no-restricted-imports` allows
  Integrations and Auth only through their exported entry points (`IntegrationsGithubService` and
  its typed results, `AccountHandleService`, the `integration.deleted` / `user.deleted` event
  types) and refuses their entities, the encryption service and the GitHub client;
  `no-restricted-globals` bans `fetch`.
- **Static Jest spec** (`*.spec.ts`, in the style of `core/tests/cache-policy.coverage.spec.ts`;
  no app boot, no database):
  - scans the `repositories/**` sources, tests excluded, for the forbidden tokens: the
    `auth_users` and `integrations` table names in query strings or `@Entity` mappings,
    `secret_iv`, and `NOW(` / `CURRENT_TIMESTAMP`;
  - asserts that no Repositories entity maps an `auth_users` or `integrations` table;
  - asserts that the exported `IntegrationsGithubService` result types carry no credential
    field, against a fixed allowlist of each result's keys.
- **Review still applies:** the security and data-access agents review every implementation PR;
  the tooling catches regressions between reviews.

### Frontend tests

Jasmine specs in the house style of the Integrations page, in three layers. Each spec file
mirrors its source under `frontend/specs/assets/js/`.

1. **Client spec** (`RepositoriesClient`), with `specs/support/fetchSequence.js`:
   - every route's method (`POST`), URL and body, all targeting Kerghan's API base;
   - the mapping of error answers to `ApiError`, including `error.retryAfterSeconds`;
   - the `AccountsClient` additions (`POST /auth/account/mine.json`, the handle-only `PATCH`).
2. **Controller specs**, with a harness like `specs/support/integrationsControllerHarness.js`: a
   fixed `NOW`, state-setter spies, `jasmine.clock()` and `flushMicrotasks`. They cover polling
   and when it stops, the Refresh countdown and its `429` adoption, Add state kept by `githubId`
   across a reload, banner dismissal, the empty-page jump, frozen rows while syncing, the Added
   row under the "Not added" filter, and the Account handle section's load, save and validation
   flow.
3. **Render specs**, with `elementTree` / `renderedOutput`: texts and links (the
   `https://github.com/<owner>/<name>` URL-encoding, the Integrations and Account links), muted
   badges and tooltips, banners per status, the empty states and the no-match message, the
   spinner vs the syncing indicator, the navbar link, the handle section, and no handle on the
   admin user pages.

- **Builders:** `buildRepository`, `buildSyncState` and `buildSource` in `specs/support/` mirror
  [routes](../backend/routes/repositories.md)'s response shapes; specs override only the fields they test.
- **Static "no `api.github.com`" spec:** frontend sources never contain `api.github.com`. Repo
  links point to `github.com` web URLs only and are rendered as links, never fetched.

### Cache tests

- **`core/tests/cache-policy.coverage.spec.ts`** gains `RepositoriesController` (and the
  controller of `POST /auth/account/mine.json`, if new) in `KNOWN_CONTROLLERS`, and asserts that
  each Repositories route declares `CacheClass.UserScoped` and the account `mine.json` route
  declares its documented class, `CacheClass.Never` ([data model](auth/github-handle.md#reading-it-post-authaccountminejson)).
- **`X-Skip-Cache` on the wire** is asserted by the [route access matrix](#route-access-matrix).
- **`navi/` is unchanged:** no resource file for `/repositories/*` or
  `/auth/account/mine.json`, following [cache-warmer.md](../cache-warmer.md) (user-scoped and
  never-cached routes are never warmed). The cache agent's read-only review confirms it on each
  implementation PR; there is no Navi-specific test.

### Where tests live

- Each test is listed once, in the "Required tests" section of the doc that owns its rule;
  other files link to it instead of repeating it.
- [edge cases](repositories/edge-cases.md#required-tests) lists only cross-module scenario specs, all of
  type (b).
- Coverage thresholds stay as they are.

## Required tests

Tiers, fakes and harnesses: [Testing](#testing). Tags: `(db)`, `(e2e)`, `(unit)`, `(static)`, `(race)` ([default tiers](#default-tier-by-category)). Each rule is tested from the "Required tests" section of the file that owns it.

### Model tests

**Tables:**

- A second row for the same (`user_id`, `github_id`) is rejected; two users can each hold one;
  a `github_id` above 2³¹ is stored and read back exactly.
- `source_key` uniqueness: one source row per (repository, source), one page row and one status
  row per (user, source[, page]).
- The Repositories migrations run up and down.
- A sync that returns a known `github_id` with a new owner/name/visibility updates the row
  instead of creating one.
- A dangling `integration_id` is read as empty `(unit)`.

**Row statuses:**

- `added_at` null ⇒ Not added; set ⇒ Added while a source returns it.
- An added repo missing from every successful source ⇒ Unavailable; missing while one of its
  sources failed ⇒ Unknown.
- An added repo held only by a `pending` source's rows reads Unknown; one source row from an
  `ok` source makes it Added.
- An added repo held only by a `page_cap_reached` source's rows reads Added.
- An added repo held only by a `not_found` handle source's rows reads Unknown.
- A current source with no status row reads `pending`.
- An added private repo whose linked integration was deleted ⇒ Unavailable after the deletion
  and before the next sync, even if another integration still sees it (that sync then
  [fills the link](repositories/sync.md#link-fill)); an added public repo in the same case stays Added.

**Pruning and deletion:**

- Pruning deletes only not-added repos with no source row; a repo still held by a failed source's
  rows, or added, is kept; another user's rows are untouched.
- Deleting an integration drops its source, page and status rows, clears `integration_id`,
  deletes not-added repos left with no source, and keeps added ones (Unavailable); every
  statement is scoped by `user_id`, so the intruder's rows for the same `github_id` are untouched.
- The `user.deleted` listener deletes the user's rows from all five tables and no other user's
  rows; its failure is logged at error level and does not throw.
- A request entry point does not create the sync-state row for a user that no longer exists.
- A sync run's start-of-run handle reconciliation never creates the sync-state row; with no row,
  the run stops.


### Security tests


**Route access matrix** (one table-driven e2e spec, [Testing](#route-access-matrix)):

- Rows: the four Repositories routes, `POST /auth/account/mine.json`, and the handle path of
  `PATCH /auth/account.json`.
- Every row: `401 UNAUTHORIZED` without a session; rejected by `OriginGuard` from a foreign
  origin; `X-Skip-Cache` sent.
- Repo-ref rows: another user's repository answers a body identical to a missing one (timestamp
  ignored).
- An admin session gets no access to another user's repositories; `/admin/users/*` carries no
  repository-derived field (counts, flags, names, sync state) and no `githubHandle`.
- **Completeness:** a Repositories route registered in Nest but missing from the table fails the
  spec.
- `cache-policy.coverage.spec.ts` asserts `CacheClass.UserScoped` on every Repositories route and
  the documented class on `POST /auth/account/mine.json` `(static)`.

**Credential canary sweep** ([Testing](#credential-canary-sweep)):

- With a PAT, an OAuth token, a GitHub App private key, a minted installation token and a GitHub
  error body/message seeded as canaries, and the `secret_iv` used by the status compare-and-set,
  no response body, response header or captured log line contains any of them, across a sync with
  every source status, the listing, the sync state, Add's success and every Add error (`404`,
  `409`, `429`, `502`, `503`).
- A GitHub error body is never returned verbatim.

**User scoping:**

- Every query is filtered by the session's user: with the [two-user baseline](#two-user-baseline),
  the intruder's rows are never returned or changed by any route or sync.
- No response reveals that another user holds or added the same GitHub repository.
- Add's own-rows lookup and identical `404`s: [routes](../backend/routes/repositories.md#required-tests).

**Module boundaries** ([module boundaries](#module-boundaries)):

- The ESLint override refuses, in `backend/src/repositories/**`, an import of an Integrations or
  Auth entity, of the encryption service or of the GitHub client, and any use of `fetch`
  `(static)`.
- The static boundary spec finds no `auth_users` / `integrations` table name and no `secret_iv`
  in the Repositories sources, no Repositories entity mapping those tables, and no key outside
  the allowlist in the exported `IntegrationsGithubService` result types; so the Repositories
  module never handles a decrypted credential `(static)`. (Its `NOW()` check is
  [sync](repositories/sync.md#required-tests)'s.)

**Owned elsewhere** (linked, not repeated):

- Installation tokens (cache kept in the module, `metadata: read`, a mint across a Replace never
  cached), fixed host, own page URLs and no redirect followed, no `Authorization` on
  unauthenticated calls: [GitHub service](integrations/github-service.md#required-tests).
- Zombie runs and the `run_id` lock release, the atomic claim and the cooldown, the handle
  source storing no private repo: [sync](repositories/sync.md#required-tests).
- Integration-deletion cleanup; handle normalisation, validation, edit path, default user and
  admins: [data model](#model-tests).

### UI tests


- The Repositories link shows for a logged-in user and is hidden while awaiting approval.
- Each row renders `owner/name` linked to `https://github.com/<owner>/<name>` (URL-encoded),
  visibility, sources and status.
- Add shows a spinner, turns the row Added on success, and shows the inline error matching
  each answer (`404`, `502`/`503`, `429`).
- The filter defaults to All; filter, search and pagination drive the listing request.
- Stored rows show with the syncing indicator; the full spinner shows only on the first sync.
- Polling runs every 2 s while `syncing`, stops on `idle` / unmount / `401` (reloading the page on
  `idle`), and keeps going on a transient error.
- The Refresh countdown follows `refreshAvailableAt`; Refresh is disabled while syncing; a `429`
  shows the cooldown notice and the countdown adopts `retryAfterSeconds`.
- Each banner text maps to its status; `ok` and `pending` show none; only `invalid_credentials`
  links to Integrations, and the handle banner never does.
- With no handle and no integration, the empty state links to Account and Integrations.
- The Account page shows the GitHub handle section, prefilled from
  `POST /auth/account/mine.json` (empty for `null`), disabled while loading, with the load-error
  text on failure.
- Saving sends only `{ githubHandle }` (no `currentPassword`), `null` for an empty input; the
  input then shows the response's normalised value and the matching success message.
- An invalid handle shows the inline error and sends no request; `@name` and mixed case pass
  client-side validation.
- A server error shows `error.message` in the section's alert.
- The username / email / password form never sends `githubHandle`.
- The section works for the default user (no password asked).
- The admin user list and edit pages show no handle.
- The client spec: every `RepositoriesClient` and `AccountsClient` request is a `POST` (or the
  handle-only `PATCH`) to Kerghan's API base, with the documented URL and body; error answers map
  to `ApiError`, with `error.retryAfterSeconds`.
- No frontend source contains `api.github.com`; repo links point to `github.com` web URLs and are
  never fetched `(static)`.
- A not-ok source badge renders muted with "<source> could not be refreshed"; a `pending` one
  with "<source> has not been synced yet"; an `ok` or `page_cap_reached` one is not muted.
- The `not_found` banner shows its text and links to the Account page.
- A `409 REPOSITORY_SOURCE_UNUSABLE` on Add shows the inline error with the Integrations link.
- An empty page above 1 after a reload jumps to the last page and reloads once.
- Rows do not change while syncing.
- Add state survives the reload.
- An Added row stays under the "Not added" filter until the next reload or a filter change.
- A `404` on a pruned row shows the inline error; the row is gone after the next reload.
- Only integration sources show the `invalid_credentials` banner.
- A dismissed banner stays hidden for the same (source, status, `syncedAt`) and returns for a new
  `syncedAt` or a page reload.
- A deleted integration's badge and banner disappear on reload.
- The no-source empty state, the "No repositories found" state and the no-match message each
  render in their case.

## Index

| Doc | Defines |
|---|---|
| This page | Overview, data model (tables, `source_key`, row statuses, logical FKs, user deletion, private-metadata lifecycle and pruning rule, ownership), security, frontend, testing strategy |
| [Sync](repositories/sync.md) | Sources and the handle's credential, trigger (stale / Refresh), in-process execution and the injected `SyncLauncher`, per-user lock, the injected `Clock`, lease recovery, pagination, write path, partial failures, pruning, rate limits, ETags, values |
| [Edge cases](repositories/edge-cases.md) | The edge-case matrix: every case, its outcome and the rule behind it |
| [Routes — Repositories](../backend/routes/repositories.md) | Routes, request/response contract, repo ref, sync state and polling, errors, access rules, Add rate limit |
| [Integrations — GitHub service](integrations/github-service.md) | `IntegrationsGithubService`, the GitHub client, endpoints per source, installation-token cache, `401 → invalid`, `integration.deleted` |
| [Auth — GitHub handle](auth/github-handle.md) | `auth_users.github_handle`, `AccountHandleService`, handle changes, the default user |
