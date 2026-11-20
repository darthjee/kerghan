# Repositories routes — Errors and access

Error responses and access rules. Back to the [Routes — Repositories](../repositories.md) hub.

## Errors

Standard error shape (`core/http-exception.filter.ts`,
[Error responses](../../../architecture/backend/error-responses.md#error-responses)).

| Status | Code | Message | Where |
|---|---|---|---|
| `400` | `VALIDATION_FAILED` | standard validation message | Listing body; Add ref (both/neither, malformed `fullName`, non-integer `githubId`) |
| `401` | `UNAUTHORIZED` | standard | Every route without a session (`JwtGuard`), or whose session user no longer exists (the handle reconciliation finds no user) |
| `403` | `FORBIDDEN` | standard | Foreign origin (`OriginGuard`) |
| `404` | `NOT_FOUND` | `Repository not found` | Add: ref not among the caller's rows, held only by another user, or denied by GitHub. **Same message for every case.** |
| `409` | `REPOSITORY_SOURCE_UNUSABLE` (new) | `The integration that sees this repository needs attention.` | Add with no candidate: every source holding the repo is a non-usable integration and the handle source does not hold it |
| `429` | `REPOSITORY_REFRESH_COOLDOWN` (new) | `Repositories were synced recently; try again later` | Refresh inside the cooldown |
| `429` | `REPOSITORY_ADD_RATE_LIMITED` (new) | `Too many repositories added; try again later` | Add over the per-user limit |
| `502` | `GITHUB_UNAVAILABLE` (existing) | `GitHub is unavailable; try again later` | Add re-check timeout / `5xx` |
| `503` | `GITHUB_RATE_LIMITED` (existing) | `GitHub rate limit reached; try again later` | Add re-check on a low budget or a GitHub rate limit |

- **Retry delay:** both `429`s, and the `503` when the reset time is known, send `Retry-After`
  (whole seconds, rounded up) **and** `error.retryAfterSeconds` in the body, with the same value.
  The filter (`core/http-exception.filter.ts`) emits both for every throw site that sets
  `retryAfterSeconds` (so `INTEGRATION_TEST_COOLDOWN` and the Integrations `503` carry the body
  field too). It is a new, optional field of the standard error shape; it is documented in
  [Backend architecture](../../../architecture/backend/error-responses.md#error-responses).
- Sync failures never become HTTP errors: they appear only as the per-source `status` in the
  [sync state](identity-and-sync.md#sync-state); the UI maps each to its banner text.
- GitHub error bodies and messages are never echoed, nor any credential detail. Anything
  unexpected falls through to the existing `500 INTERNAL_ERROR`.
- The three new codes join `ErrorCodes` (`core/error-codes.ts`); their helpers live in the
  Repositories module, like `integrations/integration-http-errors.ts`. The `502`/`503` reuse the
  existing helpers `githubUnavailable()` / `githubRateLimited()`, moved (unchanged) from
  `integrations/integration-http-errors.ts` to `core/github-http-errors.ts`, so Repositories
  never imports Integrations' HTTP layer ([GitHub service](../../../modules/integrations/github-service/add-and-deletion.md#shared-502--503-helpers)).

## Access

- Every query is scoped to the session's user.
- Another user's repository, or a repository the user cannot see, answers `404` like a missing
  one.
- Admins have no access to anyone's repositories (same rule as integrations).
- No response includes credential material (secrets, tokens, GitHub App installation tokens) or
  anything computed from it ([security](../../../architecture/security.md#github-credentials-stay-in-the-backend)).
- **Exposed identifiers:** no response includes the internal repository `id`, `user_id` or an
  internal `integrations.id`. Integrations are referenced only by their `uuid` and label, and only
  the caller's own. Repo responses carry no other integration field (no `secretHint`,
  `github_login`, `status_reason` or metadata).
- The field is named `uuid`; it holds the same value the Integrations API exposes as `id`
  ([routes/integrations.md](../../../modules/integrations/github-service.md)).
- `sources[].integration` and `accessIntegration` are resolved through a lookup also filtered by
  the caller's `user_id`: an integration that does not match (another user's, or deleted) is
  dropped from `sources[]` and reads as `null` in `accessIntegration`.

