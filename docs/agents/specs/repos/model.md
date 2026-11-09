# Repositories — Data model

The data owned by a new **Repositories** backend module, plus one new column owned by Auth.
Part of the [Repositories specs](README.md).

## Tables

The Repositories module owns five tables, under its own prefix
([modular pattern](../../architecture/modular-pattern.md#database-strategy)).

**Conventions** follow `integrations`: `int` auto-increment `id`, plain `int` `user_id` (no
relation, logical FK), explicit `varchar` lengths, `datetime`, index names
`idx_<table>_<cols>`, unique or not (`isUnique: true`), as in `integrations`. MySQL's default
`utf8mb4_0900_ai_ci` collation gives the case-insensitive `fullName` lookup ([api.md](api.md#repo-ref)).

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
| `integration_id` | Nullable. The access link, set on Add ([integrations.md](integrations.md#access-link-on-add)). Logical FK to `integrations.id`. Empty for a repo added through the public source only. |
| `last_seen_at` | When a source page last returned the repo (`200` or `304`), even if that source failed on a later page. Informational: no status derives from it ([sync.md](sync.md#write-path)). |
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
([sync.md](sync.md#partial-failures)).

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

One row per user, keyed by `user_id`, created on first use with
`INSERT … ON DUPLICATE KEY UPDATE user_id = user_id` ([sync.md](sync.md#per-user-lock)):

- `state`: `idle` or `syncing`;
- `run_id`: the running sync's UUID, `null` when idle; every write of a run is guarded by it;
- `last_started_at`: set by every claim, **never cleared**: the cooldown anchor; the API's
  `startedAt` while syncing and `refreshAvailableAt` derive from it ([api.md](api.md#sync-state));
- `heartbeat_at`: bumped after every GitHub page; a `syncing` row whose heartbeat is older than
  the lease reads as `idle` ([sync.md](sync.md#restart-recovery));
- `last_synced_at`: end of the last finished sync;
- `handle`: the GitHub handle the stored `handle` source rows belong to (normalised, `null` when
  none); written only by the [handle reconciliation](#handle-changes), never by a sync run.

It survives across requests, so staleness and partial failures are known on every listing. The
lock and its claim are defined in [sync.md](sync.md#per-user-lock).

Every timestamp of these tables (`last_started_at`, `heartbeat_at`, `last_synced_at`,
`last_seen_at`, `synced_at`, `added_at`, the lease) is set and compared from the injected
`Clock`, never `NOW()` in SQL ([sync.md](sync.md#time-source)).

### `repositories_source_statuses`

The **per-source status** of the latest run of each source, one row per (user, `source_key`):
**ok**, **error**, **invalid credentials**, **rate limited** (with `reset_at`), **page cap
reached**, **not found** (`not_found`, handle source only: the handle listing answered `404`,
[sync.md](sync.md#handle-credential)), and `synced_at`.

- A current source with no row (added since the last sync) reads `pending`
  ([api.md](api.md#sync-state)).
- A table, not JSON on the sync state: each source writes its status in its own transaction, and
  the deletion hook drops one row.

## GitHub handle

A new nullable **`github_handle`** column on `auth_users`, owned by the **Auth** module and
edited from its own section of the Account page ([ui.md](ui.md#github-handle-field)).

- Its public repositories are a source of the listing ([sync.md](sync.md#sources)).
- It is **not** an environment-managed field: the default user
  ([default-user.md](../../modules/auth/default-user.md)) can set it too. There is no env var to
  set it.
- The default user's boot sync never touches or resets `github_handle`.
- The Repositories module reads it only through Auth's exported service
  ([Auth export](#auth-export)), never from `auth_users` directly.

### Column

`github_handle varchar(39) NULL`, default `null`, added by an Auth migration.

- **No index and no uniqueness.** Nothing looks a user up by handle. Two Kerghan accounts may
  hold the same handle (one person with two accounts, or a team watching the same public
  profile); a unique index would make a `409` reveal which handle another user holds.
- `null` means "no handle": the listing then has no handle source.

### Normalisation

Applied to the request value before validation, in this order:

1. Trim surrounding whitespace.
2. Strip **one** leading `@` (`@darthjee` → `darthjee`).
3. An empty result means **clear**: stored as `null`.
4. Lowercase. GitHub logins are case-insensitive, so the stored form is canonical: every
   comparison (the [handle change](#handle-changes) check, `sources[].handle`) is plain equality,
   and a case-only edit stores nothing new.

`null` in the request also means clear. Any other type (number, object, array, boolean) answers
`400 VALIDATION_FAILED`.

### Validation

After normalisation, the handle must match GitHub's username format:

```text
^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$
```

Letters and digits, single hyphens only (no `--`), no leading or trailing hyphen, 1 to 39
characters. Anything else answers `400 VALIDATION_FAILED` in the standard error shape, with the
field message `githubHandle must be a valid GitHub username` and nothing stored. The same rule
(case-insensitively) is the owner rule of a `fullName` repo ref ([api.md](api.md#repo-ref)).

Kerghan does not check that the handle exists on GitHub when it is saved: an unknown handle shows
up as the handle source's status after the next sync: `not_found`
([sync.md](sync.md#handle-credential)).

**URL-encoding:** whenever the handle is interpolated into a GitHub path, it goes through
`encodeURIComponent`. The format already excludes every path character; the encoding is defence
in depth ([security.md](security.md#github-handle)).

### Setting it: `PATCH /auth/account.json`

The existing self-edit route gains one optional body field:

| Field | Type | Meaning |
|---|---|---|
| `githubHandle` | `string \| null`, optional | The new handle, normalised and validated as above; `null` or `""` clears it. Absent: unchanged. |

- **Presence:** `assertAnyFieldPresent` counts `githubHandle` as present whenever the key is in
  the body, `null` included. Its message becomes
  `At least one of username, email, newPassword or githubHandle is required`.
- **`currentPassword` is required only when a managed field is present** (`username`, `email`,
  `newPassword`; `hasManagedField`). Today it is required on every edit (`UpdateAccountDto`).
- **Handle-only edit** (no managed field present):
  - needs no `currentPassword` (ignored if sent, never checked);
  - skips the lockout check (`423`) and the abuse guard entirely: it never counts as a failure
    and never resets the counter;
  - order: `assertAnyFieldPresent` → validation (`400`) → load the user (`401` if missing) →
    write → `200`.
  - **Why:** the handle is a public, non-credential preference, so re-authentication adds no
    protection; skipping the password check also means the path is no password oracle. And the
    default user usually cannot know its password (the standalone client generates it), so a
    password-gated handle would be unreachable for it.
- **Mixed edit** (a managed field and `githubHandle`): the existing path, unchanged
  ([default-user.md](../../modules/auth/default-user.md#order-of-checks)): default-user block,
  lockout, `currentPassword`, availability. The handle is written in the same update as the other
  fields, all or nothing: any refusal stores no handle either.
- **Response:** `{ username, email, githubHandle }` (today `{ username, email }`), on both
  paths. `githubHandle` is the stored, normalised value or `null`.
- Changing the handle never revokes sessions and never triggers a sync
  ([handle changes](#handle-changes)).

### Reading it: `POST /auth/account/mine.json`

A new Auth route, so the Account page can show the current handle (no account read route exists
today; the Account form is not prefilled).

- `JwtGuard`, `@CachePolicy(CacheClass.Never)` (`X-Skip-Cache: true`), `POST` so `OriginGuard`
  covers it like every other user-scoped read. No body.
- `201` (Nest's `POST` default) `{ "username": "…", "email": "…", "githubHandle": "darthjee" }`;
  `githubHandle` is `null` when unset. Always the session's own user; no id in the request.
- `401` when the session's user no longer exists, as `PATCH /auth/account.json` does.

### Default user

`github_handle` is not managed, so the default-user block narrows to the managed fields only:

- The block keeps its rule, **per field, by presence**: a request whose target is the default
  user answers `409 DEFAULT_USER_MANAGED` when it contains any managed field (`username`,
  `email`, `newPassword`), even with the stored value.
- A **handle-only** edit by the default user passes the block and is applied like any user's.
- A **mixed** edit by the default user is refused whole with `409`: the handle is not stored
  either. The block still runs before the lockout and the `currentPassword` check, unchanged.
- Boot sync never reads or writes `github_handle`; turning the feature off or on leaves it as
  it is.
- **Rationale, replacing "every editable field is managed today"** in
  [default-user.md](../../modules/auth/default-user.md#what-is-blocked): an unmanaged field is
  now editable, so "in practice every edit reaching the default user is rejected" no longer
  holds. The `409` still carries **no `error.details`**: the managed fields are a fixed,
  documented list, so a client can tell from its own request which field caused the refusal, and
  the Account page sends the handle from its own section, never mixed with managed fields
  ([ui.md](ui.md#github-handle-field)). A read-side indicator stays out of scope. #452 folds this
  into `default-user.md` ([README](README.md#product-changes-folded-by-452)).

### Admins

Admins neither see nor edit the handle:

- `POST /admin/users/search.json` items keep `{ id, username, email, isAdmin, createdAt, status }`.
- `POST /admin/users/:id/edit.json` keeps `AdminUpdateUserDto` unchanged, so a `githubHandle`
  field is not part of its contract: the global `ValidationPipe` whitelist rejects it with `400`
  (or strips it, whichever the pipe's current `forbidNonWhitelisted` setting does; it is never
  written either way).
- The admin pages are unchanged.
- **Why:** the handle only drives the user's own listing, which admins cannot see
  ([security.md](security.md#user-scoping)); there is no admin need for it, and it is one less
  identity field exposed to admins.

### Auth export

Auth exports one new provider for other modules, alongside `AuthService` and `SESSION_LOOKUP`:

```ts
AccountHandleService#getGithubHandle(userId: number): Promise<string | null>
```

It returns the stored, normalised handle, or `null` (no handle, or no such user). It is read-only;
only Auth writes the column. The Repositories module calls it, never `auth_users`.

### Handle changes

When the handle changes or is cleared, the handle source's stored rows (its
`repositories_sources`, `repositories_source_pages` and `repositories_source_statuses` rows,
`source_key = 'handle'`) belong to the old handle and must go. This is done **lazily, by the
Repositories module**, through the `handle` column of
[`repositories_sync_states`](#repositories_sync_states): the handle the stored handle rows belong
to.

- **Reconciliation.** Every Repositories entry point that reads or writes the handle source (the
  listing, the sync-state route, Refresh, Add, and every sync run when it starts) first reads the
  current handle through the [Auth export](#auth-export) and compares it with
  `repositories_sync_states.handle` (missing row: `null`). Equal: nothing to do. Different: one
  transaction that
  1. creates the sync-state row if missing and locks it (`SELECT … FOR UPDATE`), re-comparing
     under the lock (a concurrent request may already have reconciled). **A sync run never
     creates the row:** its start-of-run reconciliation only locks an existing row, and with no
     row the run stops ([sync.md](sync.md#write-path)). Only the request entry points (the
     listing, the sync-state route, Refresh, Add) create it, so a run never recreates the row of
     a deleted user ([user deletion](#user-deletion));
  2. deletes the user's `source_key = 'handle'` source, page and status rows (`AND user_id =
     :userId` on each statement);
  3. sets `handle` to the current value;
  4. [prunes](#private-metadata-lifecycle).
- **Effect:** a new handle reads `pending` until a sync runs it ([api.md](api.md#sync-state));
  a cleared handle has no handle source at all. Not-added repos only the old handle returned are
  pruned; added ones read Unavailable (or stay Added through another source).
- **No sync is triggered** by a handle change, and the Refresh cooldown is unchanged: the new
  handle is fetched on the next stale listing or Refresh.
- **Mid-sync change:** the run guards its handle-source writes with the handle it started with
  ([sync.md](sync.md#write-path)), so a run that started before the change never writes rows for
  the old handle after the reconciliation. Every other mid-sync case is in the
  [edge-case matrix](edge-cases.md#handle).
- **Why lazy, not an event:** Auth emitting an event that Repositories handles would make Auth
  know about Repositories, which already depends on Auth; reading on use keeps the dependency
  one-way and has no failure window between the Auth write and the cleanup. The handle source
  holds only public metadata ([sync.md](sync.md#sources)), so leaving its rows until the next
  Repositories request has no privacy cost. Rejected: an awaited event like the integration
  deletion hook ([integrations.md](integrations.md#deletion-hook)), needed there because private
  metadata must go at once.

## Row statuses

Derived from stored data on read, never stored as a column:

| Status | Rule |
|---|---|
| **Added** | `added_at` is set, it has at least one source row from a source whose latest status is `ok` or `page_cap_reached`, and it is not unavailable under the private-link rule below. |
| **Not added** | `added_at` is `null`. |
| **Unavailable** | `added_at` is set, and either it has **no source row left** (every source that returned it later succeeded without returning it: deleted, renamed out of reach, access lost, or its only access integration deleted), or it is **private** and its `integration_id` is empty or dangling (its linked integration was deleted, #444). A public repo whose link was cleared stays available through the unauthenticated path. |
| **Unknown** | `added_at` is set, and every source row it has belongs to a source that is not ok: its latest status is a failure (`error`, `invalid_credentials`, `rate_limited`, `not_found`), or it has no status row yet (`pending`, for example a first run interrupted after it applied pages). |

Statuses are read from `repositories_sources` together with `repositories_source_statuses`. A
failed source never makes a repo unavailable: its rows are kept as they were
([sync.md](sync.md#partial-failures)).

- **`page_cap_reached` counts as `ok`:** every row it holds within the cap was just returned, and
  its rows past the cap are trimmed ([sync.md](sync.md#write-path)).
- **`pending` counts as not ok:** a source with rows but no status row (its first run was
  interrupted) cannot vouch for them.
- **An empty link is refilled:** an added private repo with an empty or dangling
  `integration_id` reads Unavailable only until the next sync's [link fill](sync.md#link-fill)
  gives it a usable integration that returns it; it then reads Added again.

## Logical foreign keys

`user_id` → `auth_users` and `integration_id` → `integrations` are **logical** FKs only: no
physical constraint, no cross-module JOIN ([modular pattern](../../architecture/modular-pattern.md#database-strategy)).
The `integrations.user_id` cascade remains the project's only physical cross-module FK.

Consequences:

- **Integration deleted:** the Repositories module is told, then drops that integration's source,
  page and status rows, clears `integration_id` wherever it points at it, and
  [prunes](#private-metadata-lifecycle) ([integrations.md](integrations.md#deletion-hook)).
  The hook receives the owning `user_id` with the integration id, and every statement in it
  (the `integration_id` clear, the deletes by `source_key = 'integration:<id>'`, the pruning)
  includes `AND user_id = :userId`. Reads treat a dangling `integration_id` as empty.
- **User deleted:** the user's repositories, sources and sync state must not outlive them
  ([user deletion](#user-deletion)).

- **Hook mechanism:** an awaited `integration.deleted` event (`IntegrationDeletedEvent { userId,
  integrationId }`), emitted by the Integrations service with `emitAsync` **after the delete
  commits**; Repositories' listener runs the cleanup above in one transaction. A listener failure
  is logged and never blocks the delete (`204` stands); the end-of-sync
  [safety net](sync.md#write-path) drops the rows of any integration no longer among the user's
  ([integrations.md](integrations.md#deletion-hook)). A direct call would make the two modules
  import each other.

### User deletion

No user-deletion path exists today. This is the Repositories contract for when one does.

- **Event:** the deletion path emits an awaited **`user.deleted`** event
  (`UserDeletedEvent { userId }`) with `emitAsync`, **after the user row delete commits**: the
  same pattern as `integration.deleted`.
- **Listener:** Repositories' listener, registered at boot like the `integration.deleted` one,
  runs one transaction that deletes the user's rows from all five tables: `repositories`,
  `repositories_sources`, `repositories_source_pages`, `repositories_source_statuses` and
  `repositories_sync_states`. Every statement has `WHERE user_id = :userId`.
- **Best-effort:** a listener failure is logged **at error level** with safe fields (`userId`,
  error class), so the rows can be purged, and never blocks the deletion. The future deletion
  path must retry the event or run an orphan sweep ([README](README.md#product-changes-folded-by-452)).
- **No row created for a deleted user:** a request entry point creates the sync-state row only
  if the user still exists, re-read through Auth's export
  ([Auth export](#auth-export)) in the same transaction, so a request that passed `JwtGuard`
  before the delete committed creates no orphan.
- **A running sync:** the deleted sync-state row makes the run's next `run_id`-guarded write
  affect no row, so the run rolls back and stops; a run never recreates the row
  ([handle changes](#handle-changes), [sync.md](sync.md#write-path)).
- **Why not a physical cascade:** it keeps logical FKs only, so `integrations.user_id` stays the
  project's only physical cross-module FK. Orphans left by a failed listener are visible to no
  one: under normal operation MySQL 8 never reuses an auto-increment `id`, so no future user can
  inherit them. A backup restore or a manual `AUTO_INCREMENT` reset could reuse one, which is why
  the deletion path retries the event or sweeps orphans. The risk is retention, not exposure.
- **Integrations cascade:** the user's integrations go through their own `ON DELETE CASCADE`,
  which emits no `integration.deleted`. The `user.deleted` listener covers their Repositories
  rows anyway.
- #452 records the contract in the Repositories module doc and in `modules/auth.md`
  ([README](README.md#product-changes-folded-by-452)).

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
  ([sync.md](sync.md#pruning)); and after changes that orphan rows outside a sync: an
  integration's source rows dropped by the [deletion hook](#logical-foreign-keys) (the `integration.deleted` event), and the handle changed or cleared (its source, page and status rows dropped by the
  [handle reconciliation](#handle-changes) on the next Repositories request, so a new handle reads
  `pending`).
- **Race with Add:** pruning deletes only `added_at IS NULL` rows, and Add's write is
  `UPDATE … WHERE id = :id AND user_id = :userId AND added_at IS NULL` ([api.md](api.md#add)).
  Add commits first ⇒ the row is skipped;
  pruning first ⇒ Add's update affects no row and Add answers `404 NOT_FOUND` (the repo left the
  listing, [api.md](api.md#add)). Every other case is in the [edge-case matrix](edge-cases.md).
- Rejected: a grace period before pruning. Private metadata would outlive access, against #444's
  lifecycle rule; failed sources are already protected by keeping their rows.

## Ownership

- Every row belongs to exactly one Kerghan user, set from the session, never from the request.
- Two users who see or add the same GitHub repo get two independent rows; nothing is shared.

## Required tests

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
- An added repo held only by a `pending` source's rows reads Unknown; one source row from an
  `ok` source makes it Added.
- An added repo held only by a `page_cap_reached` source's rows reads Added.
- An added repo held only by a `not_found` handle source's rows reads Unknown.
- The `user.deleted` listener deletes the user's rows from all five tables and no other user's
  rows; its failure is logged at error level and does not throw.
- A request entry point does not create the sync-state row for a user that no longer exists.
- A sync run's start-of-run handle reconciliation never creates the sync-state row; with no row,
  the run stops.
- An added private repo whose linked integration was deleted ⇒ Unavailable after the deletion
  and before the next sync, even if another integration still sees it (that sync then
  [fills the link](sync.md#link-fill)); an added public repo in the same case stays Added.
- The default user's boot sync leaves `github_handle` unchanged.
- Handle normalisation: `"  @DarthJee "` is stored as `darthjee`; `""`, `"  "`, `"@"` and `null`
  clear it; a number, object, array or boolean answers `400`.
- Handle validation: `a`, `a-b`, `a1-b2-c3` and a 39-character handle are accepted; a
  40-character handle, `-a`, `a-`, `a--b`, `a_b`, `a.b`, `a/b`, `a b` and non-ASCII letters answer
  `400 VALIDATION_FAILED` with the field message, and nothing is stored.
- A handle-only `PATCH /auth/account.json` succeeds without `currentPassword`, ignores a wrong
  one, succeeds while the user is locked out, and leaves the abuse-guard counter untouched (no
  failure, no reset).
- A managed field without `currentPassword` answers `400`; a mixed edit with a wrong
  `currentPassword` answers `400`, counts as a failure, and stores no handle.
- `{}` and a body with only `currentPassword` answer `400` with the new message;
  `{ "githubHandle": null }` is a valid edit.
- The response carries `githubHandle` on both paths; `POST /auth/account/mine.json` returns
  `{ username, email, githubHandle }` for the session's user only, sends `X-Skip-Cache`, and
  answers `401` without a session or for a deleted user.
- Default user (feature enabled): a handle-only edit answers `200` and stores the handle; a mixed
  edit answers `409 DEFAULT_USER_MANAGED` and stores nothing; with the feature off both behave as
  for any user.
- Admin routes: search items carry no `githubHandle`; `githubHandle` sent to
  `POST /admin/users/:id/edit.json` is never written.
- `AccountHandleService#getGithubHandle` returns the stored handle, `null` for no handle and for an
  unknown user.
- Handle reconciliation: changing the handle drops the `handle` source, page and status rows,
  sets `repositories_sync_states.handle`, prunes not-added repos only the old handle returned,
  keeps added ones (Unavailable unless another source returns them), and the new handle reads
  `pending`; clearing it leaves no handle source; an unchanged handle (or a case-only edit) is a
  no-op; two concurrent requests reconcile once; another user's rows are untouched.
- A handle change triggers no sync and does not move `last_started_at`.
- Deleting an integration drops its source, page and status rows, clears `integration_id`,
  deletes not-added repos left with no source, and keeps added ones (Unavailable).
- A dangling `integration_id` is read as empty.
- No query of the Repositories module reads `auth_users` or `integrations` tables directly.
- One user's rows are never returned or changed for another user.
