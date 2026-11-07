# Repositories — Data model

The data owned by a new **Repositories** backend module, plus one new column owned by Auth.
Part of the [Repositories specs](README.md).

## Tables

The Repositories module owns three tables, under its own prefix
([modular pattern](../../architecture/modular-pattern.md#database-strategy)). The names below
are working names.

> **Open — settled by #447:** exact table names, column types and lengths, indexes beyond the
> unique key below, the shape of the per-user sync state, and how each source page's `ETag` is
> stored (keyed per user and source, never shared between users).

### `repositories`

One row per (user, GitHub repository) **seen in a sync**. There is no separate "remote repo"
entity: the same row is the persisted snapshot of the GitHub repo and records whether the user
added it.

| Column | Meaning |
|---|---|
| `id` | Internal primary key. |
| `user_id` | Owner. Logical FK to `auth_users.id`. |
| `github_id` | GitHub's numeric repository id. The stable key. |
| `owner` | Last known owner login. |
| `name` | Last known repository name. |
| `private` | Last known visibility. |
| `added_at` | Nullable. Set when the user adds the repo; `null` means not added. |
| `integration_id` | Nullable. The access link, set on Add ([integrations.md](integrations.md#access-link-on-add)). Logical FK to `integrations.id`. Empty for a repo added through the public source only. |
| `last_seen_at` | The last successful sync of a source that returned the repo. |
| `created_at`, `updated_at` | Timestamps. |

- **Unique** on (`user_id`, `github_id`): a user has at most one row per GitHub repo.
- **Renames and transfers are followed through `github_id`:** each sync refreshes `owner`,
  `name` and `private`.
- Indexes also cover the listing filters and name search (e.g. `user_id` + `added_at`,
  `user_id` + `owner`/`name`).

### Sources table

Working name `repositories_sources`. Which sources returned each repo in the **latest sync** of
that source: one row per (repository, integration), plus one row with a **public handle**
marker for the unauthenticated/handle source.

It drives the per-row source badges ([ui.md](ui.md#table)) and the access-link choice on Add.

### Sync state

Working name `repositories_sync_states`. One row per user:

- `last_synced_at`;
- the sync state: `idle` or `syncing`;
- the **per-source status** of the latest sync, one of: **ok**, **error**, **invalid
  credentials**, **rate limited**, **page cap reached** (with the reset time when rate
  limited).

It survives across requests, so staleness and partial failures are known on every listing.

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
> edit the handle (their response shapes with #446).

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

- **Integration deleted:** the Repositories module is told, then drops that integration's source
  rows and clears `integration_id` wherever it points at it
  ([integrations.md](integrations.md#deletion-hook)). Reads treat a dangling `integration_id` as
  empty.
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

> **Open — settled by #447:** the exact pruning rule for not-added repos (when it runs, how a
> failed source affects it).

## Ownership

- Every row belongs to exactly one Kerghan user, set from the session, never from the request.
- Two users who see or add the same GitHub repo get two independent rows; nothing is shared.

## Required tests

Tests for the open points above are added by the issue that settles them.

- A second row for the same (`user_id`, `github_id`) is rejected; two users can each hold one.
- A sync that returns a known `github_id` with a new owner/name/visibility updates the row
  instead of creating one.
- `added_at` null ⇒ Not added; set ⇒ Added while a source returns it.
- An added repo missing from every successful source ⇒ Unavailable; missing while one of its
  sources failed ⇒ Unknown.
- An added private repo whose linked integration was deleted ⇒ Unavailable, even if another
  integration still sees it; an added public repo in the same case stays Added.
- The default user's boot sync leaves `github_handle` unchanged.
- Deleting an integration drops its source rows, clears `integration_id`, deletes not-added repos
  left with no source, and keeps added ones (Unavailable).
- A dangling `integration_id` is read as empty.
- No query of the Repositories module reads `auth_users` or `integrations` tables directly.
- One user's rows are never returned or changed for another user.
