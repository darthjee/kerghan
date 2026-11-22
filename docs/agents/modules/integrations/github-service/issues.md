# Integrations — GitHub service: issues

Part of the [GitHub service](../github-service.md) of the [Integrations module](../../integrations.md).
The only code that calls GitHub with a user's credential for issues (#554). The product rules are
in [sync.md](../../../specs/issues/sync.md#github-issue-client-operations) and
[security.md](../../../specs/issues/security.md#the-integrations-boundary).

## Operations

| Operation | Service | Request | Success kinds | Issue-specific kinds (plus the shared failures) |
|---|---|---|---|---|
| `getIssue(userId, integrationId, repo, number, etag?)` | `IntegrationsGithubService` | `GET /repos/{owner}/{name}/issues/{number}` | `ok{issue, etag, renamedTo?}`, `not_modified` | `not_found`, `gone` (`410`), `moved`, `forbidden` |
| `probeIssues(userId, integrationId, repo)` | `IntegrationsGithubService` | `GET /repos/{owner}/{name}/issues?per_page=1` | `ok` | `not_found`, `forbidden` |
| `updateIssue(userId, integrationId, repo, number, changes)` | `IntegrationsGithubIssueWriter` | `PATCH /repos/{owner}/{name}/issues/{number}` | `ok{issue, renamedTo?}` | `not_found`, `gone`, `moved`, `forbidden` |

- `repo` is `{ githubId, owner, name }` (from the repository row); `issue` is
  `{ id, number, title, body, state, updatedAt, isPullRequest }`; `renamedTo` is `{ owner, name }`.
  The types are in `github-issue-results.ts` and re-exported from `integrations-github.public.ts`.
- The shared failures are `invalid_credentials`, `rate_limited{resetAt}`, `unavailable{reason}` and
  `integration_unusable{reason}`. `forbidden` (a `403` that is not a rate limit) is its own kind.
- The integration is loaded owner-scoped, usability is checked and the credential is decrypted by
  the shared authenticated runner (`github-authenticated-runner.ts`), which both services use. A
  `401` invalidates a `pat` / `oauth_app` integration; for a `github_app` it evicts the token and
  retries once ([status and errors](status-and-errors.md)).
- The path is built only from the stored `owner`, `name` and `number`, each URL-encoded, on the
  fixed base `https://api.github.com`. Body caps: 512 KiB for an issue, 64 KiB for the probe.
- Logs carry the integration id, operation, HTTP status and result kind only: never a title, body,
  token, URL, `Location` or GitHub error body.

## The writer

`IntegrationsGithubIssueWriter` (`integrations-github-issue-writer.service.ts`) is exported from
`IntegrationsModule` and `integrations-github.public.ts`. It is the **only** service that sends a
non-`GET` request to GitHub with a user's credential; `IntegrationsGithubService` stays `GET`-only.

- `changes` holds only `title?`, `body?` and `state?` (`open` / `closed`). `assertIssueChanges`
  throws a `TypeError` for any other field (including `state_reason`) before the integration is
  loaded or GitHub is called. The body sent is the diff it was given, never a full `PATCH`.
- A followed rename resends the same body (the values are fixed, so the resend is idempotent).
- **Boundary (static specs):** `integrations-writer-boundary.spec.ts` fails when a file outside
  Integrations injects `IntegrationsGithubIssueWriter` (its allowlist is empty in #554; #558 adds
  the issues sync service), and `integrations-github-get-only.spec.ts` asserts that
  `IntegrationsGithubService` makes no non-`GET` call.

## GitHub App token permissions

| Operation | Permission set |
|---|---|
| Repository listings | `{ metadata: read }` |
| `getIssue`, `probeIssues` | `{ issues: read, metadata: read }` |
| `updateIssue` | `{ issues: write }` |

The sets are in `github-installation-permissions.ts`. `GithubInstallationTokenCache` is keyed by
`integrationId` and the permission set, so a token is never reused across sets; single-flight and
the replace guard work per entry, and `evict(integrationId)` drops every set of that integration.
An installation still on `issues: read` is accepted, and its pushes answer `forbidden`
([GitHub App credentials](../github-app/credentials.md#required-permissions)).

## Redirects

No call follows a redirect automatically (`redirect: 'manual'`); classification is in
`github-issue-redirect.ts`.

- A `301` whose `Location` is exactly `https://api.github.com/repositories/{repo.githubId}/issues/{number}`
  (same repository id and issue number, no other scheme, host, port, query or path shape) is a
  **rename**: the client retries once at that `Location` with the same request and the result
  carries `renamedTo`, parsed from the answer's `repository_url`. A missing or malformed value
  answers `unavailable{reason:'unexpected'}`. `renamed` never leaves the adapter.
- Any other `Location` on `https://api.github.com` is a **transfer**: `moved`.
- An unclassifiable `Location` (another scheme, host or port, or a malformed URL), or a second
  `301` in one call, is not followed, sends no credential and answers `unavailable{reason:'redirect'}`.
- **Assumption:** "any other `api.github.com` target means moved" is unverified for a transferred
  issue until the live contract mode records one (commented in the classifier and the spec).

## Tests

- **Fake and builders:** `FakeIntegrationsGithubService` answers the three operations (`asWriter()`
  gives the writer view); the builders are in `tests/support/github-issue-builders.ts`
  ([Repositories testing](../../repositories/testing.md#repositories-typed-fake)).
- **Fidelity contract spec:** `integrations-github.contract.spec.ts` runs every builder case of each
  issue operation through the real service at the `fetch` level and compares it with the fake.
- **Redirect and `Location` contract spec:** `github-issue-redirect.contract.spec.ts` records GitHub's
  `200`, `404`, `410` and `301` answers (including the rename form) and runs in CI. Its **opt-in
  live mode** runs the same cases against GitHub only when these are set, and is skipped otherwise:
  `KERGHAN_GITHUB_CONTRACT_LIVE=1`, `KERGHAN_GITHUB_CONTRACT_TOKEN` (can read the repo),
  `KERGHAN_GITHUB_CONTRACT_REPO` (`owner/name`) and `KERGHAN_GITHUB_CONTRACT_ISSUE`; optionally
  `KERGHAN_GITHUB_CONTRACT_DELETED_ISSUE` (a `410`) and `KERGHAN_GITHUB_CONTRACT_TRANSFERRED_ISSUE`
  (to record the transfer `Location`).
