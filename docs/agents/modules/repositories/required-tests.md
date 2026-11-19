# Repositories — Required tests

The required model, security and UI tests. Part of the [Repositories module](../repositories.md).

Tiers, fakes and harnesses: [Testing](testing.md). Tags: `(db)`, `(e2e)`, `(unit)`, `(static)`, `(race)` ([default tiers](testing.md#default-tier-by-category)). Each rule is tested from the "Required tests" section of the file that owns it.

## Model tests

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
  [fills the link](sync/write-path.md#link-fill)); an added public repo in the same case stays Added.

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


## Security tests


**Route access matrix** (one table-driven e2e spec, [Testing](testing-coverage.md#route-access-matrix)):

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

**Credential canary sweep** ([Testing](testing-coverage.md#credential-canary-sweep)):

- With a PAT, an OAuth token, a GitHub App private key, a minted installation token and a GitHub
  error body/message seeded as canaries, and the `secret_iv` used by the status compare-and-set,
  no response body, response header or captured log line contains any of them, across a sync with
  every source status, the listing, the sync state, Add's success and every Add error (`404`,
  `409`, `429`, `502`, `503`).
- A GitHub error body is never returned verbatim.

**User scoping:**

- Every query is filtered by the session's user: with the [two-user baseline](testing-coverage.md#two-user-baseline),
  the intruder's rows are never returned or changed by any route or sync.
- No response reveals that another user holds or added the same GitHub repository.
- Add's own-rows lookup and identical `404`s: [routes](../../backend/routes/repositories.md#required-tests).

**Module boundaries** ([module boundaries](security.md#module-boundaries)):

- The ESLint override refuses, in `backend/src/repositories/**`, an import of an Integrations or
  Auth entity, of the encryption service or of the GitHub client, and any use of `fetch`
  `(static)`.
- The static boundary spec finds no `auth_users` / `integrations` table name and no `secret_iv`
  in the Repositories sources, no Repositories entity mapping those tables, and no key outside
  the allowlist in the exported `IntegrationsGithubService` result types; so the Repositories
  module never handles a decrypted credential `(static)`. (Its `NOW()` check is
  [sync](sync/required-tests.md#required-tests)'s.)

**Owned elsewhere** (linked, not repeated):

- Installation tokens (cache kept in the module, `metadata: read`, a mint across a Replace never
  cached), fixed host, own page URLs and no redirect followed, no `Authorization` on
  unauthenticated calls: [GitHub service](../integrations/github-service/required-tests.md#required-tests).
- Zombie runs and the `run_id` lock release, the atomic claim and the cooldown, the handle
  source storing no private repo: [sync](sync/required-tests.md#required-tests).
- Integration-deletion cleanup; handle normalisation, validation, edit path, default user and
  admins: [data model](#model-tests).

## UI tests


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

