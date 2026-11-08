# Repositories — Data model

The data owned by a new **Repositories** backend module, plus one new column owned by Auth.
Part of the [Repositories specs](README.md).

## Tables

The Repositories module owns five tables, under its own prefix
([modular pattern](../../architecture/modular-pattern.md#database-strategy)).

**Conventions** follow `integrations`: `int` auto-increment `id`, plain `int` `user_id` (no
relation, logical FK), explicit `varchar` lengths, `datetime`, index names
`idx_<table>_<cols>` / `uq_<table>_<cols>`. MySQL's default `utf8mb4_0900_ai_ci` collation gives
the case-insensitive `fullName` lookup ([api.md](api.md#repo-ref)).

**Source key:** every per-source row identifies its source with `source_key varchar(32)`:
`integration:<id>` or `handle`. Not a nullable `integration_id` (MySQL unique indexes allow
several `NULL`s) nor a `0` sentinel.

| Table | Columns | Indexes |
|---|---|---|
| `repositories` | `id`; `user_id int`; `github_id bigint`; `owner varchar(39)`; `name varchar(100)`; `private boolean`; `added_at datetime NULL`; `integration_id int NULL`; `last_seen_at datetime`; `created_at`, `updated_at` | unique (`user_id`, `github_id`); (`user_id`, `added_at`); (`user_id`, `owner`, `name`); (`integration_id`) |
| `repositories_sources` | `id`; `user_id int`; `repository_id int`; `source_key`; `page smallint` | unique (`repository_id`, `source_key`); (`user_id`, `source_key`, `page`) |
| `repositories_source_pages` | `id`; `user_id int`; `source_key`; `page smallint`; `etag varchar(255)`; `has_next boolean`; `fetched_at datetime` | unique (`user_id`, `source_key`, `page`) |
| `repositories_sync_states` | `user_id int`; `state varchar(16)`; `run_id char(36) NULL`; `last_started_at datetime NULL`; `heartbeat_at datetime NULL`; `last_synced_at datetime NULL`; `created_at`, `updated_at` | unique (`user_id`) |
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
| `github_id` | GitHub's numeric repository id. The stable key. `bigint`, mapped to a JS number: GitHub ids will pass 2³¹ but stay far below 2⁵³. |
| `owner` | Last known owner login (`varchar(39)`, GitHub's limit). |
| `name` | Last known repository name (`varchar(100)`, GitHub's limit). |
| `private` | Last known visibility. |
| `added_at` | Nullable. Set when the user adds the repo; `null` means not added. |
| `integration_id` | Nullable. The access link, set on Add ([integrations.md](integrations.md#access-link-on-add)). Logical FK to `integrations.id`. Empty for a repo added through the public source only. |
| `last_seen_at` | When a source page last returned the repo (`200` or `304`), even if that source failed on a later page. Informational: no status derives from it ([sync.md](sync.md#write-path)). |
| `created_at`, `updated_at` | Timestamps. |

- **Unique** on (`user_id`, `github_id`): a user has at most one row per GitHub repo.
- **Renames and transfers are followed through `github_id`:** each sync refreshes `owner`,
  `name` and `private` (`INSERT … ON DUPLICATE KEY UPDATE`, which never touches `added_at` or
  `integration_id`).
- Indexes: (`user_id`, `added_at`) for the listing filters, (`user_id`, `owner`, `name`) for the
  sort and `fullName` lookup, (`integration_id`) for the deletion hook.

### `repositories_sources`

Which sources returned each repo in the **latest sync** of that source, and on which page: one
row per (repository, `source_key`).

- `user_id` is denormalised, for per-user/per-source cleanup without a join.
- `page` records what each page contained, so a `304` keeps that page's rows and a successful
  source deletes the rows past its last page ([sync.md](sync.md#write-path)).
- It drives the per-row source badges ([ui.md](ui.md#table)), the access-link choice on Add, the
  row statuses and [pruning](#private-metadata-lifecycle).

### `repositories_source_pages`

One row per (user, source, page): the page's `etag`, whether it had a next page (`has_next`) and
`fetched_at`. Used for conditional requests ([sync.md](sync.md#conditional-requests)); never
shared between users.

### `repositories_sync_states`

One row per user, created on first use (insert ignoring duplicates):

- `state`: `idle` or `syncing`;
- `run_id`: the running sync's UUID, `null` when idle; every write of a run is guarded by it;
- `last_started_at`: set by every claim, **never cleared**: the cooldown anchor; the API's
  `startedAt` while syncing and `refreshAvailableAt` derive from it ([api.md](api.md#sync-state));
- `heartbeat_at`: bumped after every GitHub page; a `syncing` row whose heartbeat is older than
  the lease reads as `idle` ([sync.md](sync.md#restart-recovery));
- `last_synced_at`: end of the last finished sync.

It survives across requests, so staleness and partial failures are known on every listing. The
lock and its claim are defined in [sync.md](sync.md#per-user-lock).

### `repositories_source_statuses`

The **per-source status** of the latest run of each source, one row per (user, `source_key`):
**ok**, **error**, **invalid credentials**, **rate limited** (with `reset_at`), **page cap
reached**, and `synced_at`.

- A current source with no row (added since the last sync) reads `pending`
  ([api.md](api.md#sync-state)).
- A table, not JSON on the sync state: each source writes its status in its own transaction, and
  the deletion hook drops one row.

## GitHub handle

A new nullable **`github_handle`** column on `auth_users`, owned by the **Auth** module and
edited from the existing account edit form ([ui.md](ui.md#github-handle-field)).

- Its public repositories are a source of the listing ([sync.md](sync.md#sources)).
- It is **not** an environment-managed field: the default user
  ([default-user.md](../../modules/auth/default-user.md)) can set it too. There is no env var to
  set it.
- The default user's boot sync never touches or resets `github_handle`.
- The Repositories module reads it only through Auth's exported service, never from
  `auth_users` directly.

> **Open — settled by #449:** the column type, the exact validation (GitHub's username format),
> normalisation (case, trimming), how `PATCH /auth/account.json`'s `409 DEFAULT_USER_MANAGED`
> block narrows to the managed fields, and whether admin endpoints (`/admin/users/*`) show or
> edit the handle (and, if they do, their response shapes).

## Row statuses

Derived from stored data on read, never stored as a column:

| Status | Rule |
|---|---|
| **Added** | `added_at` is set, at least one source returned it in its latest sync, and it is not unavailable under the private-link rule below. |
| **Not added** | `added_at` is `null`. |
| **Unavailable** | `added_at` is set, and either the latest sync of **every** source that used to return it succeeded without returning it (deleted, renamed out of reach, access lost, or its only access integration deleted), or it is **private** and its `integration_id` is empty or dangling (its linked integration was deleted, #444). A public repo whose link was cleared stays available through the unauthenticated path. |
| **Unknown** | `added_at` is set, it is not returned by any source in their latest syncs, and at least one source that used to return it **failed** in its latest sync. |

A failed source never makes a repo unavailable: its rows are kept as they were
([sync.md](sync.md#partial-failures)).

## Logical foreign keys

`user_id` → `auth_users` and `integration_id` → `integrations` are **logical** FKs only: no
physical constraint, no cross-module JOIN ([modular pattern](../../architecture/modular-pattern.md#database-strategy)).
The `integrations.user_id` cascade remains the project's only physical cross-module FK.

Consequences:

- **Integration deleted:** the Repositories module is told, then drops that integration's source,
  page and status rows, clears `integration_id` wherever it points at it, and
  [prunes](#private-metadata-lifecycle) ([integrations.md](integrations.md#deletion-hook)).
  Reads treat a dangling `integration_id` as empty.
- **User deleted:** the user's repositories, sources and sync state must not outlive them.

> **Open — settled by #448:** the integration-deletion hook mechanism (a direct call vs an
> event).

> **Open — settled by #450:** the user-deletion cleanup path.

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
DELETE r FROM repositories r
WHERE r.user_id = :userId AND r.added_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM repositories_sources s WHERE s.repository_id = r.id)
```

- **When:** at the end of each sync, in its final `run_id`-guarded transaction
  ([sync.md](sync.md#pruning)); and right after changes that orphan rows outside a sync: an
  integration's source rows dropped by the [deletion hook](#logical-foreign-keys) (#448 picks the
  mechanism), the handle changed or cleared (its source and page rows dropped; #449 owns the
  handle edit).
- **Race with Add:** pruning deletes only `added_at IS NULL` rows, and Add's write is
  `UPDATE … WHERE id = :id AND user_id = :userId`. Add commits first ⇒ the row is skipped;
  pruning first ⇒ Add's update affects no row and Add answers `404 NOT_FOUND` (the repo left the
  listing, [api.md](api.md#add)). The rest of the edge-case matrix stays with #450.
- Rejected: a grace period before pruning. Private metadata would outlive access, against #444's
  lifecycle rule; failed sources are already protected by keeping their rows.

## Ownership

- Every row belongs to exactly one Kerghan user, set from the session, never from the request.
- Two users who see or add the same GitHub repo get two independent rows; nothing is shared.

## Required tests

Tests for the open points above are added by the issue that settles them.

- A second row for the same (`user_id`, `github_id`) is rejected; two users can each hold one;
  a `github_id` above 2³¹ is stored and read back exactly.
- `source_key` uniqueness: one source row per (repository, source), one page row and one status
  row per (user, source[, page]).
- Pruning deletes only not-added repos with no source row; a repo still held by a failed source's
  rows, or added, is kept.
- Add losing the race with pruning answers `404` and writes nothing.
- A current source with no status row reads `pending`.
- A sync that returns a known `github_id` with a new owner/name/visibility updates the row
  instead of creating one.
- `added_at` null ⇒ Not added; set ⇒ Added while a source returns it.
- An added repo missing from every successful source ⇒ Unavailable; missing while one of its
  sources failed ⇒ Unknown.
- An added private repo whose linked integration was deleted ⇒ Unavailable, even if another
  integration still sees it; an added public repo in the same case stays Added.
- The default user's boot sync leaves `github_handle` unchanged.
- Deleting an integration drops its source, page and status rows, clears `integration_id`,
  deletes not-added repos left with no source, and keeps added ones (Unavailable).
- A dangling `integration_id` is read as empty.
- No query of the Repositories module reads `auth_users` or `integrations` tables directly.
- One user's rows are never returned or changed for another user.
