# Repositories — Security

Security and abuse rules for the Repositories feature. Part of the
[Repositories specs](README.md).

## Credentials stay in the backend

**Every GitHub call that uses a user's credential is made by the backend, and no endpoint ever
returns credential material (secrets, tokens, GitHub App installation tokens) or anything
computed from it, beyond the masked `secretHint` of the Integrations routes.** Data fetched
*with* a credential (the private-repo listing) is not credential material.

- In this feature, every GitHub call happens in the backend, authenticated or not; the frontend
  never calls GitHub for the listing.
- Inside the backend, credentials stay **inside the Integrations module**
  ([integrations.md](integrations.md#exported-service)).
- A minted GitHub App installation token is a credential too: it is cached **in process memory
  only**, inside the Integrations module (in a `Secret`), never in the database, a log or a
  response, and minted with `metadata: read` only
  ([installation tokens](integrations.md#github-app-installation-tokens)). Any other persistence
  needs its own product decision (`CLAUDE.md`, #295).
- Repo responses carry no integration field beyond its `uuid` and label
  ([api.md](api.md#access)).
- **The `secret_iv` compare value stays inside the Integrations module.** The status
  [compare-and-set](integrations.md#status-compare-and-set) uses the `secret_iv` of the credential
  a call used; it never reaches the Repositories module, a response or a log.
- This rule is cross-cutting: #452 promotes it to `docs/agents/architecture/security.md` as its
  own section (alongside "CSRF"), linked from `docs/agents/modules/integrations.md`.

Guarantees of the exported `IntegrationsGithubService`
([integrations.md](integrations.md#exported-service)):

- **Nothing sensitive leaves the module:** no decrypted credential, minted installation token or
  GitHub response body is returned, logged or exposed; callers get typed, normalised results
  only, and logs carry safe fields (integration id, operation, HTTP status, result kind).
- **Owner-scoped:** every call loads the integration with `WHERE id = ? AND user_id = ?`; a
  missing or foreign one answers `integration_unusable` without a GitHub call.
- **Fixed operations:** `GET`-only, with fixed endpoints and parameters; no generic
  `request(path)`, so no caller chooses a path.

### Module boundaries

The boundary is enforced by tooling, not left to review alone
([testing.md](testing.md#module-boundaries)):

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

## User scoping

- Every query is filtered by the session's user id **in the query itself** (`… AND user_id = ?`),
  never by loading a row and comparing afterwards.
- Another user's repository answers `404` identical to a missing one: same status, code and
  message.
- No response, error code or message reveals that another user holds or added the same GitHub
  repository.
- Add looks up the caller's own row before any GitHub call ([api.md](api.md#add)).
- No response exposes `user_id` or an internal `integrations.id` ([api.md](api.md#access)).
- Admins have no access to anyone's repositories (same rule as integrations), and the existing
  admin endpoints (`/admin/users/*`) carry no repository-derived field (counts, flags, names,
  sync state).
- Every endpoint requires `JwtGuard` and sends `X-Skip-Cache` ([api.md](api.md#every-route)).
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
  ([sync.md](sync.md#rate-limits)). A per-user cap would need its own decision.

## Add verification

Add only accepts a repository already in the caller's own listing, and is verified with GitHub
([api.md](api.md#add)), so a user cannot add a repository, or learn its metadata, by guessing a
GitHub repository id or an `owner/name`.

- The [repo ref](api.md#repo-ref) is `{ githubId }` or `{ fullName }`; a `fullName` resolves
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
  metadata stays tied to it ([api.md](api.md#add)).
- The rate limit is **30 Adds per 60 s** per user by default, configurable
  ([api.md](api.md#add-rate-limit)). The unauthenticated re-check honours **Add's own
  threshold** (refused at remaining ≤ 0; the sync stops at ≤ 10), and each Add makes at most 3
  GitHub calls ([candidate walk](integrations.md#add-re-check-candidates)).

## Private metadata lifecycle

Private metadata is kept only while a source can still see it, except for added repos, kept as
unavailable ([model.md](model.md#private-metadata-lifecycle)). The handle source keeps only
public repos, so private metadata is always tied to the integration that granted it
([sync.md](sync.md#sources)); when a sync turns a repo private, its `handle` source row is
dropped, so a stale handle row never keeps it alive ([sync.md](sync.md#write-path)).

- A capped source deletes its rows past the cap, so a lowered cap never keeps private metadata
  past any check ([sync.md](sync.md#write-path)).
- The end-of-sync [link fill](sync.md#link-fill) ties an added private repo with an empty or
  dangling link back to a usable integration that returns it.
- Rows of non-usable integrations are kept until the integration is fixed or deleted, visible
  only to their owner ([integrations.md](integrations.md#usable-integrations)).
- A deleted user's rows are removed by the `user.deleted` listener; orphans left by a failed
  listener are visible to no one under normal operation, since an auto-increment `id` is not
  reused; the deletion path retries the event or sweeps orphans for the cases where one could be
  (backup restore, `AUTO_INCREMENT` reset): retention, not exposure
  ([model.md](model.md#user-deletion)).
- The handle source status `not_found` only says that a public GitHub login does not exist.

## GitHub handle

Column, normalisation, validation and edit path: [model.md](model.md#github-handle).

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
  ([model.md](model.md#handle-changes)); the handle source holds only public repos, so the lag
  exposes no private metadata.

## Fixed GitHub base URL

The backend only ever calls `https://api.github.com`. No user input chooses the host or a path
outside the endpoints this feature uses, so there is no SSRF surface.

A single client, in the Integrations module, makes every GitHub call of the feature, with or
without a credential ([unauthenticated calls](integrations.md#unauthenticated-calls)); without
one it sends no `Authorization` header. Server-supplied URLs are never requested:

- pagination builds its own page URLs (`?per_page=100&page=N`) and reads `Link` only to know
  whether `rel="next"` exists; it never requests a URL taken from a response
  ([sync.md](sync.md#per-source));
- **no redirect is followed**, same-origin or not (the repo operations use `redirect: 'manual'`, and
  classifies any `3xx` other than `304` as `unavailable` (`redirect`)): a `Location` is a
  response-supplied URL. Any such `3xx` makes a sync source `error` and
  Add answer `502 GITHUB_UNAVAILABLE`, and `Authorization` is never sent to another host.

Repository links in the UI are built by the frontend from `owner` and `name`
([ui.md](ui.md#table)); a GitHub-supplied URL is never rendered.

## CSRF

Every route is `POST`, reads included, so `OriginGuard` covers all four
([architecture/security.md](../../architecture/security.md#csrf)). The listing's stale-sync
trigger is therefore not a state change over `GET`, and needs no exception
([api.md](api.md#stale-sync-trigger)).

## Errors and logging

- Exact codes and messages: the [error table](api.md#errors) in `api.md`.
- Sync failures never become HTTP errors: they surface only as the per-source `status` of the
  [sync state](api.md#sync-state), which the UI maps to fixed banner texts.
- GitHub error bodies and messages are never echoed to the client, nor any credential detail;
  anything unexpected is `500 INTERNAL_ERROR`.
- Credentials never appear in logs or error responses.

## Abuse and performance

- One sync per user at a time (an atomic claim with a lease), a Refresh cooldown, a per-source
  page cap, a hard deadline per sync, and an early stop of the unauthenticated source on a low
  rate-limit budget, tracked process-wide and shared with Add ([sync.md](sync.md#values)). The
  tracker reserves each granted call before it is sent, so parallel sources and concurrent Adds
  never overshoot the budget ([sync.md](sync.md#rate-limits)).
- Timeouts and a parallelism bound on GitHub calls.
- A sync that lost its lease cannot write: every write is guarded by its `run_id`
  ([sync.md](sync.md#restart-recovery)).

## Required tests

- No response of the feature contains a credential or a value derived from one.
- The Repositories module never handles a decrypted credential.
- Every route is user-scoped in the query: another user's repository answers the same `404` as a
  missing one; admins get no access; admin user endpoints carry no repository-derived field.
- No response reveals that another user holds the same GitHub repository.
- Add with a GitHub repository id not in the caller's own rows answers `404` without a GitHub
  call; one GitHub does not grant answers `404` and writes nothing.
- A `fullName` ref never resolves another user's row; every Add `404` carries the same message
  ([api.md](api.md#required-tests)).
- A cached installation token never leaves the Integrations module.
- A GitHub App mint in flight across a Replace is never cached.
- No Repositories code, response or log carries `secret_iv` (the status compare-and-set value).
- The exported service never returns, logs or exposes a decrypted credential, a minted
  installation token or a GitHub response body; a foreign `integrationId` answers
  `integration_unusable` without a GitHub call.
- An unauthenticated call (`integrationId: null`) sends no `Authorization` header.
- Installation tokens are minted with `{"permissions": {"metadata": "read"}}` only.
- The handle source stores no private repo.
- Pagination never requests a URL supplied by a response (a `Link` URL, even same-origin); no
  redirect is followed, same-origin `301`/`302` included, and `Authorization` never leaves
  `https://api.github.com`.
- A zombie sync run cannot write or release a newer run's lock.
- Deleting an integration purges not-added repos only it could see.
- An invalid handle is rejected before storage; a stored handle is URL-encoded in the GitHub
  path.
- A handle-only `PATCH /auth/account.json` never checks `currentPassword` (a wrong one does not
  change the answer and is not counted); a request with a managed field still requires it.
- The default user (feature enabled) can set its handle alone; any request with a managed field
  answers `409` before the lockout and the password check, and stores nothing.
- Admin user endpoints neither return nor write `githubHandle`.
- `POST /auth/account/mine.json` returns only the caller's own account, sends `X-Skip-Cache`, and
  is rejected from a foreign origin.
- Saving a handle another user already holds succeeds and reveals nothing.
- Every GitHub call targets `https://api.github.com`.
- Every route (listing and sync state included) from a foreign origin is rejected by
  `OriginGuard`.
- A GitHub error body is never returned verbatim; no credential is logged.
- A second concurrent sync and a Refresh inside the cooldown are refused.
