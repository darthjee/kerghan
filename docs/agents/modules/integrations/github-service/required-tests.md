# Integrations — GitHub service: Required tests

Part of the [GitHub service](../github-service.md) of the [Integrations module](../../integrations.md).

## Required tests

Tiers, fakes and harnesses: [Testing](../../repositories/testing.md). Tags: `(db)`, `(e2e)`, `(unit)`,
`(static)`, `(race)` ([default tiers](../../repositories/testing.md#default-tier-by-category)).

**Exported service:**

- No credential, minted token or GitHub body leaves the service: the
  [canary sweep](../../repositories/required-tests.md#security-tests).
- A missing or foreign `integrationId` answers `integration_unusable` with reason `missing`,
  without a GitHub call (a call for an integration deleted mid-sync included).
- `listUsableIntegrations` returns only usable integrations, oldest first, filtered by `user_id`
  in the query.
- Non-usable integrations (`expired`, `invalid`, `undecryptable`, type disabled) are never
  called: they answer `integration_unusable` with reason `status` or `type_disabled`. (What the
  sync stores for them is [sync](../../repositories/sync/required-tests.md#required-tests)'s.)
- **Fake fidelity:** for each shared builder case, the real service's typed result at the `fetch`
  level equals what `FakeIntegrationsGithubService` returns for the same builder
  ([Testing](../../repositories/testing.md#fake-fidelity)).

**Requests:**

- Each operation calls exactly its fixed endpoint and parameters (per type, the handle, the
  re-check), builds its own page URL (`?per_page=100&page=N`), and reads `Link` only for
  `rel="next"`, never requesting a URL supplied by a response, even a same-origin one.
- Every call targets `https://api.github.com`, and `Authorization` is never sent anywhere else.
- `integrationId: null` sends no `Authorization` header.
- A stored handle is URL-encoded in the GitHub path.
- Malformed repo entries are dropped; a listing body over 2 MiB answers `unavailable`.

**Error mapping:**

- Each row of the error-mapping table yields its result kind and its effect on the integration
  status; rate limits are detected from headers only.
- `3xx` (other than `304`) is never followed, same-origin `301`/`302` included, and answers
  `unavailable` (`redirect`).
- The handle listing's `404` answers `not_found`.
- The existing `send` callers keep mapping a `3xx` to `network_error` (`redirect: 'error'`
  default).
- The `502`/`503` helpers answer the same codes, messages and statuses from `core/` as before the
  move.

**Status compare-and-set:**

- A `401` with the current credential sets a `pat` / `oauth_app` integration `invalid`; a `401`
  from a call made before a Replace leaves the replaced integration `active`; the same holds for
  a mint `404` / `403` and a decrypt failure `(unit)`. The logic is tested at unit level by #461,
  against the in-memory repository fake; the SQL `secret_iv` compare-and-set itself runs on the
  DB-backed tier with #463 `(db)`, which already depends on #462's DB tier. **Done in #463:**
  `integrations/tests/integration-store.compare-and-set.db-spec.ts`.

**Installation tokens:**

- One mint serves concurrent calls (deferred `fetch` reply).
- A cached token is reused until `expires_at` − 5 min, as read from the `FakeClock`.
- It is minted with `{"permissions": {"metadata": "read"}}` only.
- It is evicted on `401`, delete and replace credential; a `401` with a cached token re-mints and
  retries once, and a `401` with a fresh token answers `unavailable` without changing the
  status.
- A mint in flight across a Replace is not cached; the next call mints with the new credential.
- Mint `404` / `403` / app-JWT `401` map as specified.
- A cached token never leaves the module (no getter, no log line, no result field).

**Add:**

- The candidate walk: `401` / `403` / `404` move to the next candidate; a rate limit, timeout,
  `5xx` or redirect stops it; it never makes more than 3 GitHub calls; denials everywhere end
  the walk as denied; no candidate at all ends it before any GitHub call. (The HTTP answers are
  [routes](../../../backend/routes/repositories/required-tests.md#required-tests)'s.)
- Add links the oldest usable integration that sees and grants the repo. When only the public
  source does, it links none while the repo is public, and links the integration whose re-check
  found it private.

**Unauthenticated budget tracker:**

- Concurrent acquires reserve the budget and never overshoot it (deferred `fetch` replies).
- The sync is refused at ≤ 10, Add only at ≤ 0: with remaining between 1 and 10 a sync acquire
  is refused while an Add acquire is granted; at 0 both are refused.
- A refused acquire answers `rate_limited` with the window's `resetAt` and makes no GitHub call.
- It keeps the minimum `Remaining` within a reset window: an older response with a higher
  `Remaining` arriving late does not raise it; a later `Reset` starts a new window.
- The reset window is read from the `FakeClock`: once it has passed, calls are allowed until the
  first response.
- It is shared by the sync and Add: a low budget recorded by one is seen by the other.

**Deletion hook:**

- Deleting an integration emits `integration.deleted` after the delete commits.
- A listener failure is logged with safe fields and the delete still answers `204`.
- A delete before any Repositories request still runs the cleanup (the listener is registered
  at boot). Owned by #463, which adds the listener; #461 builds the emitter side only. **Done in
  #463:** `repositories/tests/integration-deleted.at-boot.db-spec.ts` boots the real `AppModule` on
  the DB tier.
- What the cleanup deletes is [data model](../../repositories/required-tests.md#model-tests)'s.
