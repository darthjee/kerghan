# Repositories — Data model

Tables, row statuses, logical foreign keys, user deletion, private-metadata lifecycle and ownership. Part of the [Repositories module](../repositories.md).

The data owned by the Repositories module, plus one column owned by Auth
([`github_handle`](../auth/github-handle.md)).

## Tables

The Repositories module owns five tables, under its own prefix
([modular pattern](../../architecture/modular-pattern.md#database-strategy)).

**Conventions** follow `integrations`: `int` auto-increment `id`, plain `int` `user_id` (no
relation, logical FK), explicit `varchar` lengths, `datetime`, index names
`idx_<table>_<cols>`, unique or not (`isUnique: true`), as in `integrations`. MySQL's default
`utf8mb4_0900_ai_ci` collation gives the case-insensitive `fullName` lookup ([routes](../../backend/routes/repositories/identity-and-sync.md#repo-ref)).

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

### `repositories`

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
| `integration_id` | Nullable. The access link, set on Add ([GitHub service](../integrations/github-service/add-and-deletion.md#access-link-on-add)). Logical FK to `integrations.id`. Empty for a repo added through the public source only. |
| `last_seen_at` | When a source page last returned the repo (`200` or `304`), even if that source failed on a later page. Informational: no status derives from it ([sync](sync/write-path.md#write-path)). |
| `created_at`, `updated_at` | Timestamps. |

- **Unique** on (`user_id`, `github_id`): a user has at most one row per GitHub repo.
- **Renames and transfers are followed through `github_id`:** each sync refreshes `owner`,
  `name` and `private` (`INSERT … ON DUPLICATE KEY UPDATE`, which never touches `added_at` or
  `integration_id`).
- Indexes: (`user_id`, `added_at`) for the listing filters, (`user_id`, `owner`, `name`) for the
  sort and `fullName` lookup, (`user_id`, `integration_id`) for the deletion hook.

### `repositories_sources`

Which sources returned each repo, as of each source's **last applied page**, and on which page:
one row per (repository, `source_key`). A failed or interrupted source keeps its earlier rows
([sync](sync/write-path.md#partial-failures)).

- `user_id` is denormalised, for per-user/per-source cleanup without a join.
- `page` records what each page contained, so a `304` keeps that page's rows and a successful
  source deletes the rows past its last page ([sync](sync/write-path.md#write-path)).
- It drives the per-row source badges ([frontend](frontend.md#table)), the access-link choice on Add, the
  row statuses and [pruning](#private-metadata-lifecycle).

### `repositories_source_pages`

One row per (user, source, page): the page's `etag`, whether it had a next page (`has_next`) and
`fetched_at`. Used for conditional requests ([sync](sync/github-limits.md#conditional-requests)); never
shared between users.

### `repositories_sync_states`

One row per user, keyed by `user_id`, created on first use with
`INSERT … ON DUPLICATE KEY UPDATE user_id = user_id` ([sync](sync/execution.md#per-user-lock)):

- `state`: `idle` or `syncing`;
- `run_id`: the running sync's UUID, `null` when idle; every write of a run is guarded by it;
- `last_started_at`: set by every claim, **never cleared**: the cooldown anchor; the API's
  `startedAt` while syncing and `refreshAvailableAt` derive from it ([routes](../../backend/routes/repositories/identity-and-sync.md#sync-state));
- `heartbeat_at`: bumped after every GitHub page; a `syncing` row whose heartbeat is older than
  the lease reads as `idle` ([sync](sync/execution.md#restart-recovery));
- `last_synced_at`: end of the last finished sync;
- `handle`: the GitHub handle the stored `handle` source rows belong to (normalised, `null` when
  none); written only by the [handle reconciliation](../auth/github-handle.md#handle-changes), never by a sync run.

It survives across requests, so staleness and partial failures are known on every listing. The
lock and its claim are defined in [sync](sync/execution.md#per-user-lock).

Every timestamp of these tables (`last_started_at`, `heartbeat_at`, `last_synced_at`,
`last_seen_at`, `synced_at`, `added_at`, the lease) is set and compared from the injected
`Clock`, never `NOW()` in SQL ([sync](sync/execution.md#time-source)).

### `repositories_source_statuses`

The **per-source status** of the latest run of each source, one row per (user, `source_key`):
**ok**, **error**, **invalid credentials**, **rate limited** (with `reset_at`), **page cap
reached**, **not found** (`not_found`, handle source only: the handle listing answered `404`,
[sync](sync.md#handle-credential)), and `synced_at`.

- A current source with no row (added since the last sync) reads `pending`
  ([routes](../../backend/routes/repositories/identity-and-sync.md#sync-state)).
- A table, not JSON on the sync state: each source writes its status in its own transaction, and
  the deletion hook drops one row.


## Row statuses

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
[safety net](sync/write-path.md#write-path) drops it, never makes a repo Added or holds it available. A
failed source never makes a repo unavailable: its rows are kept as they were
([sync](sync/write-path.md#partial-failures)).

- **`page_cap_reached` counts as `ok`:** every row it holds within the cap was just returned, and
  its rows past the cap are trimmed ([sync](sync/write-path.md#write-path)).
- **`pending` counts as not ok:** a source with rows but no status row (its first run was
  interrupted) cannot vouch for them.
- **An empty link is refilled:** an added private repo with an empty or dangling
  `integration_id` reads Unavailable only until the next sync's [link fill](sync/write-path.md#link-fill)
  gives it a usable integration that returns it; it then reads Added again.

## Logical foreign keys

`user_id` → `auth_users` and `integration_id` → `integrations` are **logical** FKs only: no
physical constraint, no cross-module JOIN ([modular pattern](../../architecture/modular-pattern.md#database-strategy)).
The `integrations.user_id` cascade remains the project's only physical cross-module FK.

Consequences:

- **Integration deleted:** the Repositories module is told, then drops that integration's source,
  page and status rows, clears `integration_id` wherever it points at it, and
  [prunes](#private-metadata-lifecycle) ([GitHub service](../integrations/github-service/add-and-deletion.md#deletion-hook)).
  The hook receives the owning `user_id` with the integration id, and every statement in it
  (the `integration_id` clear, the deletes by `source_key = 'integration:<id>'`, the pruning)
  includes `AND user_id = :userId`. Reads treat a dangling `integration_id` as empty.
- **User deleted:** the user's repositories, sources and sync state must not outlive them
  ([user deletion](#user-deletion)).

- **Hook mechanism:** an awaited `integration.deleted` event (`IntegrationDeletedEvent { userId,
  integrationId }`), emitted by the Integrations service with `emitAsync` **after the delete
  commits**; Repositories' listener runs the cleanup above in one transaction. A listener failure
  is logged and never blocks the delete (`204` stands); the end-of-sync
  [safety net](sync/write-path.md#write-path) drops the rows of any integration no longer among the user's
  ([GitHub service](../integrations/github-service/add-and-deletion.md#deletion-hook)). A direct call would make the two modules
  import each other.

### User deletion

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
  write transaction follows ([sync](sync/write-path.md#write-path)), so it serializes with a running sync's
  page writes instead of deadlocking with them.
- **Best-effort:** a listener failure is logged **at error level** with safe fields (`userId`,
  error class), so the rows can be purged, and never blocks the deletion. A future deletion
  path must retry the event or run an orphan sweep (see [Auth](../auth/admin-and-events.md#userdeleted-event)).
- **No row created for a deleted user:** a request entry point creates the sync-state row only
  if the user still exists, re-read through Auth's export
  ([Auth export](../auth/github-handle.md#auth-export), `lockExistingUser`) in the same transaction, so a request that
  passed `JwtGuard` before the delete committed creates no orphan. The shared lock closes the
  race: while the entry point holds it, the user row delete waits for its commit (and the
  `user.deleted` listener then deletes the new row); once the delete committed, the read finds
  no user and nothing is created.
- **A running sync:** the deleted sync-state row makes the run's next `run_id`-guarded write
  affect no row, so the run rolls back and stops; a run never recreates the row
  ([handle changes](../auth/github-handle.md#handle-changes), [sync](sync/write-path.md#write-path)).
- **Why not a physical cascade:** it keeps logical FKs only, so `integrations.user_id` stays the
  project's only physical cross-module FK. Orphans left by a failed listener are visible to no
  one: under normal operation MySQL 8 never reuses an auto-increment `id`, so no future user can
  inherit them. A backup restore or a manual `AUTO_INCREMENT` reset could reuse one, which is why
  the deletion path retries the event or sweeps orphans. The risk is retention, not exposure.
- **Integrations cascade:** the user's integrations go through their own `ON DELETE CASCADE`,
  which emits no `integration.deleted`. The `user.deleted` listener covers their Repositories
  rows anyway.

## Private metadata lifecycle

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
  ([sync](sync/write-path.md#pruning)); and after changes that orphan rows outside a sync: an
  integration's source rows dropped by the [deletion hook](#logical-foreign-keys) (the `integration.deleted` event), and the handle changed or cleared (its source, page and status rows dropped by the
  [handle reconciliation](../auth/github-handle.md#handle-changes) on the next Repositories request, so a new handle reads
  `pending`).
- **Race with Add:** pruning deletes only `added_at IS NULL` rows, and Add's write is
  `UPDATE … WHERE id = :id AND user_id = :userId AND added_at IS NULL` ([routes](../../backend/routes/repositories/refresh-and-add.md#add)).
  Add commits first ⇒ the row is skipped;
  pruning first ⇒ Add's update affects no row and Add answers `404 NOT_FOUND` (the repo left the
  listing, [routes](../../backend/routes/repositories/refresh-and-add.md#add)). Every other case is in the [edge-case matrix](edge-cases.md).
- Rejected: a grace period before pruning. Private metadata would outlive access, against #444's
  lifecycle rule; failed sources are already protected by keeping their rows.

## Ownership

- Every row belongs to exactly one Kerghan user, set from the session, never from the request.
- Two users who see or add the same GitHub repo get two independent rows; nothing is shared.


