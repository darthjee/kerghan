# Auth — GitHub handle

The optional GitHub handle of an account: a nullable `auth_users.github_handle` column owned by
the [Auth module](../auth.md), whose public repositories are a source of the
[Repositories](../repositories.md) listing.

A new nullable **`github_handle`** column on `auth_users`, owned by the **Auth** module and
edited from its own section of the Account page ([frontend](../repositories.md#github-handle-field)).

- Its public repositories are a source of the listing ([sync](../repositories/sync.md#sources)).
- It is **not** an environment-managed field: the default user
  ([default user](default-user.md)) can set it too. There is no env var to
  set it.
- The default user's boot sync never touches or resets `github_handle`.
- The Repositories module reads it only through Auth's exported service
  ([Auth export](#auth-export)), never from `auth_users` directly.

## Column

`github_handle varchar(39) NULL`, default `null`, added by an Auth migration.

- **No index and no uniqueness.** Nothing looks a user up by handle. Two Kerghan accounts may
  hold the same handle (one person with two accounts, or a team watching the same public
  profile); a unique index would make a `409` reveal which handle another user holds.
- `null` means "no handle": the listing then has no handle source.

## Normalisation

Applied to the request value before validation, in this order:

1. Trim surrounding whitespace.
2. Strip **one** leading `@` (`@darthjee` → `darthjee`).
3. An empty result means **clear**: stored as `null`.
4. Lowercase. GitHub logins are case-insensitive, so the stored form is canonical: every
   comparison (the [handle change](#handle-changes) check, `sources[].handle`) is plain equality,
   and a case-only edit stores nothing new.

`null` in the request also means clear. Any other type (number, object, array, boolean) answers
`400 VALIDATION_FAILED`.

## Validation

After normalisation, the handle must match GitHub's username format:

```text
^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$
```

Letters and digits, single hyphens only (no `--`), no leading or trailing hyphen, 1 to 39
characters. Anything else answers `400 VALIDATION_FAILED` in the standard error shape, with the
field message `githubHandle must be a valid GitHub username` and nothing stored. The same rule
(case-insensitively) is the owner rule of a `fullName` repo ref ([routes](../../backend/routes/repositories.md#repo-ref)).

Kerghan does not check that the handle exists on GitHub when it is saved: an unknown handle shows
up as the handle source's status after the next sync: `not_found`
([sync](../repositories/sync.md#handle-credential)).

**URL-encoding:** whenever the handle is interpolated into a GitHub path, it goes through
`encodeURIComponent`. The format already excludes every path character; the encoding is defence
in depth ([security](../repositories.md#github-handle)).

## Setting it: `PATCH /auth/account.json`

The existing self-edit route gains one optional body field:

| Field | Type | Meaning |
|---|---|---|
| `githubHandle` | `string \| null`, optional | The new handle, normalised and validated as above; `null` or `""` clears it. Absent: unchanged. |

- **Presence:** `assertAnyFieldPresent` counts `githubHandle` as present whenever the key is in
  the body, `null` included. Its message becomes
  `At least one of username, email, newPassword or githubHandle is required`.
  The admin edit keeps its own three-field rule and message
  (`At least one of username, email, or newPassword is required`).
- **`null` managed fields are rejected:** `null` for `username`, `email` or `newPassword` answers
  `400 VALIDATION_FAILED` on this route (the admin DTO is unchanged). Only `githubHandle` accepts
  `null`.
- **`currentPassword` is required only when a managed field is present** (`username`, `email`,
  `newPassword`; `hasManagedField`). It is now optional on `UpdateAccountDto`: an empty string
  still answers `400 VALIDATION_FAILED`, and a missing one with a managed field present answers
  `400 BAD_REQUEST` (`currentPassword is required`) from the service. That refusal comes after
  the default-user block and the lockout check, and counts as an abuse-guard failure like a wrong
  password. (It used to be a `400 VALIDATION_FAILED` from the DTO.)
- **Handle-only edit** (no managed field present):
  - needs no `currentPassword` (ignored if sent, never checked);
  - skips the lockout check (`423`) and the abuse guard entirely: it never counts as a failure
    and never resets the counter;
  - order: validation (`400 VALIDATION_FAILED`, by the global `ValidationPipe`, before the
    service runs) → `assertAnyFieldPresent` (`400`) → load the user (`401` if missing) → write →
    `200`;
  - **no-op edit:** when the normalised value equals the stored one (same value, a case-only
    change, an `@`-only change, or clearing an empty handle), nothing is written and the stored
    value is returned.
  - **Why:** the handle is a public, non-credential preference, so re-authentication adds no
    protection; skipping the password check also means the path is no password oracle. And the
    default user usually cannot know its password (the standalone client generates it), so a
    password-gated handle would be unreachable for it.
- **Mixed edit** (a managed field and `githubHandle`): the existing path, unchanged
  ([default user](default-user.md#order-of-checks)): default-user block,
  lockout, `currentPassword`, availability. The handle is written in the same update as the other
  fields, all or nothing: any refusal stores no handle either.
- **Response:** `{ username, email, githubHandle }` (today `{ username, email }`), on both
  paths. `githubHandle` is the stored, normalised value or `null`.
- Changing the handle never revokes sessions and never triggers a sync
  ([handle changes](#handle-changes)).

## Reading it: `POST /auth/account/mine.json`

A new Auth route, so the Account page can show the current handle (no account read route exists
today; the Account form is not prefilled).

- `JwtGuard`, `@CachePolicy(CacheClass.Never)` (`X-Skip-Cache: true`), `POST` so `OriginGuard`
  covers it like every other user-scoped read. No body.
- `201` (Nest's `POST` default) `{ "username": "…", "email": "…", "githubHandle": "darthjee" }`;
  `githubHandle` is `null` when unset. Always the session's own user; no id in the request.
- `401` when the session's user no longer exists, as `PATCH /auth/account.json` does.

## Default user

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
  [default user](default-user.md#what-is-blocked): an unmanaged field is
  now editable, so "in practice every edit reaching the default user is rejected" no longer
  holds. The `409` still carries **no `error.details`**: the managed fields are a fixed,
  documented list, so a client can tell from its own request which field caused the refusal, and
  the Account page sends the handle from its own section, never mixed with managed fields
  ([frontend](../repositories.md#github-handle-field)). A read-side indicator is not built.

## Admins

Admins neither see nor edit the handle:

- `POST /admin/users/search.json` items keep `{ id, username, email, isAdmin, createdAt, status }`.
- `POST /admin/users/:id/edit.json` keeps `AdminUpdateUserDto` unchanged, so a `githubHandle`
  field is not part of its contract: the global `ValidationPipe` (`whitelist: true`, no
  `forbidNonWhitelisted`) strips it, and it is never written. A body holding only `githubHandle`
  therefore answers `400` with the admin's unchanged "at least one field" message.
- The admin pages are unchanged.
- **Why:** the handle only drives the user's own listing, which admins cannot see
  ([security](../repositories.md#user-scoping)); there is no admin need for it, and it is one less
  identity field exposed to admins.

## Auth export

Auth exports one new provider for other modules, alongside `AuthService` and `SESSION_LOOKUP`:

```ts
AccountHandleService#getGithubHandle(userId: number): Promise<string | null>
```

It returns the stored, normalised handle, or `null` (no handle, or no such user). It is read-only;
only Auth writes the column. The Repositories module calls it, never `auth_users`.

It also exports one manager-aware existence read, the only Auth read Repositories runs **inside
its own transaction**:

```ts
AccountHandleService#lockExistingUser(userId: number, manager: EntityManager): Promise<boolean>
```

It selects the user's `id` with a shared lock (`SELECT … FOR SHARE`, TypeORM
`pessimistic_read`) through the caller's transactional manager, and returns whether the user
still exists. A request entry point calls it before creating the sync-state row
([user deletion](../repositories.md#user-deletion)); it never reads another column.

## Handle changes

When the handle changes or is cleared, the handle source's stored rows (its
`repositories_sources`, `repositories_source_pages` and `repositories_source_statuses` rows,
`source_key = 'handle'`) belong to the old handle and must go. This is done **lazily, by the
Repositories module**, through the `handle` column of
[`repositories_sync_states`](../repositories.md#repositories_sync_states): the handle the stored handle rows belong
to.

- **Reconciliation.** Every Repositories entry point that reads or writes the handle source (the
  listing, the sync-state route, Refresh, Add, and every sync run when it starts) first reads the
  current handle through the [Auth export](#auth-export) and compares it with
  `repositories_sync_states.handle` (missing row: `null`). Equal: nothing to do. Different: one
  transaction that
  1. creates the sync-state row if missing and locks it (`SELECT … FOR UPDATE`), re-comparing
     under the lock (a concurrent request may already have reconciled). **A sync run never
     creates the row:** its start-of-run reconciliation only locks an existing row, and with no
     row the run stops ([sync](../repositories/sync.md#write-path)). Only the request entry points (the
     listing, the sync-state route, Refresh, Add) create it, so a run never recreates the row of
     a deleted user ([user deletion](../repositories.md#user-deletion));
  2. deletes the user's `source_key = 'handle'` source, page and status rows (`AND user_id =
     :userId` on each statement);
  3. sets `handle` to the current value;
  4. [prunes](../repositories.md#private-metadata-lifecycle).
- **Effect:** a new handle reads `pending` until a sync runs it ([routes](../../backend/routes/repositories.md#sync-state));
  a cleared handle has no handle source at all. Not-added repos only the old handle returned are
  pruned; added ones read Unavailable (or stay Added through another source).
- **No sync is triggered** by a handle change, and the Refresh cooldown is unchanged: the new
  handle is fetched on the next stale listing or Refresh.
- **Mid-sync change:** the run guards its handle-source writes with the handle it started with
  ([sync](../repositories/sync.md#write-path)), so a run that started before the change never writes rows for
  the old handle after the reconciliation. Every other mid-sync case is in the
  [edge-case matrix](../repositories/edge-cases.md#handle).
- **Why lazy, not an event:** Auth emitting an event that Repositories handles would make Auth
  know about Repositories, which already depends on Auth; reading on use keeps the dependency
  one-way and has no failure window between the Auth write and the cleanup. The handle source
  holds only public metadata ([sync](../repositories/sync.md#sources)), so leaving its rows until the next
  Repositories request has no privacy cost. Rejected: an awaited event like the integration
  deletion hook ([GitHub service](../integrations/github-service.md#deletion-hook)), needed there because private
  metadata must go at once.


## Required tests

Tiers, fakes and harnesses: the [Repositories testing strategy](../repositories.md#testing).

**GitHub handle:**

- The default user's boot sync leaves `github_handle` unchanged.
- Handle normalisation: `"  @DarthJee "` is stored as `darthjee`; `""`, `"  "`, `"@"` and `null`
  clear it; a number, object, array or boolean answers `400`.
- Handle validation: `a`, `a-b`, `a1-b2-c3` and a 39-character handle are accepted; a
  40-character handle, `-a`, `a-`, `a--b`, `a_b`, `a.b`, `a/b`, `a b` and non-ASCII letters answer
  `400 VALIDATION_FAILED` with the field message, and nothing is stored.
- Saving a handle another user already holds succeeds and reveals nothing.
- A handle-only `PATCH /auth/account.json` succeeds without `currentPassword`, ignores a wrong
  one (the answer does not change and nothing is counted), succeeds while the user is locked out,
  and leaves the abuse-guard counter untouched (no failure, no reset).
- A managed field without `currentPassword` answers `400`; a mixed edit with a wrong
  `currentPassword` answers `400`, counts as a failure, and stores no handle.
- `{}` and a body with only `currentPassword` answer `400` with the new message;
  `{ "githubHandle": null }` is a valid edit.
- The response carries `githubHandle` on both paths; `POST /auth/account/mine.json` returns
  `{ username, email, githubHandle }` for the session's user only, and answers `401` for a
  deleted user. (Its `401` without a session, `OriginGuard` and `X-Skip-Cache` are the
  [route access matrix](../repositories.md#security-tests)'s.)
- Default user (feature enabled): a handle-only edit answers `200` and stores the handle; a mixed
  edit answers `409 DEFAULT_USER_MANAGED` before the lockout and the password check, and stores
  nothing; with the feature off both behave as for any user.
- `githubHandle` sent to `POST /admin/users/:id/edit.json` is never written. (Admin responses
  without `githubHandle` are the [route access matrix](../repositories.md#security-tests)'s.)
- `AccountHandleService#getGithubHandle` returns the stored handle, `null` for no handle and for an
  unknown user.

**Handle changes:**

- Handle reconciliation: changing the handle drops the `handle` source, page and status rows,
  sets `repositories_sync_states.handle`, prunes not-added repos only the old handle returned,
  keeps added ones (Unavailable unless another source returns them), and the new handle reads
  `pending`; clearing it leaves no handle source; an unchanged handle (or a case-only edit) is a
  no-op; another user's rows are untouched.
- Two concurrent requests reconcile once.
- A handle change triggers no sync and does not move `last_started_at`.
