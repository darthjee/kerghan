# Repositories routes — Required tests

Tests required for the routes. Back to the [Routes — Repositories](../repositories.md) hub.

## Required tests

Tiers, fakes and harnesses: [Testing](../../../modules/repositories/testing.md). Tags: `(db)`, `(e2e)`, `(unit)`,
`(static)`, `(race)` ([default tiers](../../../modules/repositories/testing.md#default-tier-by-category)).

**Routes:**

- Per-route `401`, `OriginGuard`, `X-Skip-Cache`, the cache class, another user's repository
  answering like a missing one, and admins: the [route access matrix](../../../modules/repositories/required-tests.md#security-tests).
- No repositories route answers `GET`.
- Unknown body properties are stripped and ignored.
- Handler errors (`400`, `404`, `429`) send `X-Skip-Cache` + `Cache-Control: no-store` too; the
  headers are not asserted on the guard `401` / `403`.
- No response body contains the internal repository `id`, `user_id`, an internal
  `integrations.id`, `secretHint`, `github_login`, `status_reason`, or any other integration
  field beyond `uuid` and `label`. (Credential material is the
  [canary sweep](../../../modules/repositories/required-tests.md#security-tests)'s.)
- A row's `sources[]` and `accessIntegration` never resolve an integration of another user.
- After the GitHub handle changed or was cleared, each of the four routes, called first, answers
  without the old handle's source rows (and without not-added repos only it returned); a new
  handle reads `pending` in `sources[]`; `sources[].handle` is the normalised handle.
- A `fullName` whose owner differs only in case from the stored one resolves; an owner with
  `--`, a leading or trailing hyphen, or over 39 characters answers `400`.

**Listing:**

- It never calls GitHub synchronously; it reads from the database.
- Defaults and bounds of `page` / `perPage` / `filter` / `search`: `perPage` > 100,
  `filter: "unknown"` and `search` > 100 characters answer `400`; a past-the-end page answers
  `200` with an empty list.
- The filter accepts no Unknown value; Unknown rows appear under `all`.
- Stable sort (`owner`, `name`, `githubId`, case-insensitive); correct `pagination` totals with
  filter and search.
- `%` and `_` in `search` match literally.
- Exact row shape; `accessIntegration` is `null` in the three documented cases.
- A row's `sources[]` includes the entry of a failed source that still holds a row for it.
- A listing that starts a sync answers `sync.state: "syncing"`; when the sync starts is
  [sync](../../../modules/repositories/sync/required-tests.md#required-tests)'s.

**Sync state:**

- Exact shape; `pending` for a new source; a deleted integration's entry is gone.
- A stored `invalid_credentials` status for an integration that is now usable reports `pending`;
  one still non-usable reports `invalid_credentials`.
- A `not_found` handle status is reported as `not_found`.
- The route never starts a sync.
- A sync stuck in `syncing` past its lease reads `idle`, with `startedAt: null`.

**Refresh:**

- `202` starts a sync; `202` while syncing starts no new sync and does not reset the cooldown.
- `429 REPOSITORY_REFRESH_COOLDOWN` + `Retry-After` + `error.retryAfterSeconds` inside the
  cooldown, including right after a stale-triggered sync.
- Concurrent Refreshes, and skipping a `rate_limited` source: [sync](../../../modules/repositories/sync/required-tests.md#required-tests).

**Add:**

- Both or neither ref answers `400`; so do a `githubId` of `0`, negative, fractional or above
  `Number.MAX_SAFE_INTEGER`, and a `fullName` outside the documented format (no `/`, two `/`,
  name `.` or `..`, over-long parts).
- The GitHub re-check request is built from the stored row, never from the request's
  `fullName`.
- `fullName` resolves case-insensitively, only among the caller's rows: absent, or held only by
  another user, answers `404` without any GitHub call; so does a `githubId` not in the caller's
  rows.
- Already added answers `200`, with no GitHub call and `addedAt` unchanged.
- A GitHub denial from every candidate answers `404` and writes nothing; every `404` carries the
  same message.
- A rate limit or a low budget answers `503 GITHUB_RATE_LIMITED`, not `404`; a timeout, `5xx` or
  redirect answers `502 GITHUB_UNAVAILABLE`.
- Add with only non-usable sources (and no handle row) answers `409 REPOSITORY_SOURCE_UNUSABLE`
  with no GitHub call and no write; with one usable candidate that denies it, Add answers `404`.
- The candidate walk and the access-link choice: [GitHub service](../../../modules/integrations/github-service/required-tests.md#required-tests).
- Add on a not-added row pruned concurrently answers `404 NOT_FOUND` and writes nothing `(db)`.
- A write whose `integration_id` is another user's integration stores `null`, so the row is never
  linked to the other user's integration `(db)`.
- Two concurrent Adds of the same repo write once; both answer `200` with the same `addedAt` and
  access link `(db)`.
- The 31st Add in 60 s answers `429 REPOSITORY_ADD_RATE_LIMITED`, the window follows the
  `FakeClock`, and the env overrides apply.
- With two rows sharing a `fullName`, Add by `fullName` resolves to the latest-seen row, then the
  highest `id`.
- Add by `githubId` is unaffected by a rename.
