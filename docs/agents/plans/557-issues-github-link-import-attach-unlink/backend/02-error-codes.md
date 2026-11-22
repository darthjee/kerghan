# Error codes and helpers

Add the link codes of `api/errors-and-validation.md#error-catalogue` to `ErrorCodes`. Add one helper for each to `issues/issues-http-errors.ts`, each with its exact message and its `meta`:

- `GITHUB_ISSUE_NOT_FOUND`, `404`, `GitHub issue not found`. This is distinct from the Kerghan `404 NOT_FOUND`.
- `PROJECT_HAS_NO_REPOSITORY`, `409`, `This project has no repository`.
- `PROJECT_REPOSITORY_UNAVAILABLE`, `409`, `The project's repository is unavailable`.
- `PROJECT_REPOSITORY_CHANGED`, `409`, `The project's repository changed; try again`.
- `GITHUB_ISSUE_ALREADY_LINKED`, `409`, `This GitHub issue is already linked`, with `meta: { projectId, issueId }`, both uuids of the existing link's project and issue.
- `ISSUE_ALREADY_LINKED`, `409`, `This issue is already linked`.
- `ISSUE_ATTACH_CONFIRMATION_REQUIRED`, `409`, `Attaching replaces this issue's values`, with `meta: { differences, updatedAt }`. `differences` is a subset of `["title", "body", "state"]` in that order. `updatedAt` is the issue's ISO string with milliseconds.
- `ISSUE_NOT_LINKED`, `409`, `This issue is not linked`.
- `ISSUE_UNLINK_HAS_UNSENT_CHANGES`, `409`, `This issue has changes not yet sent to GitHub`.
- `GITHUB_CREDENTIAL_UNUSABLE`, `409`, `The integration for this repository needs attention`, with `meta: { reason }`. `reason` is one of `no_credential`, `credential_invalid` or `forbidden`.
- `GITHUB_ISSUE_IS_PULL_REQUEST`, `422`, `This is a pull request, not an issue`.
- `ISSUE_LINK_RATE_LIMITED`, `429`, `Too many link requests; try again later`, with `retryAfterSeconds`. The `Retry-After` header is set the same way as for `issueEditRateLimited`.

The `502` and `503` answers reuse `githubUnavailable()` and `githubRateLimited(retryAfterSeconds)` from `core/github-http-errors.ts`. Issues may import `core/`.

`meta` never carries internal ids or GitHub content.

## Files to Change
- `backend/src/core/error-codes.ts`: the new codes.
- `backend/src/issues/issues-http-errors.ts`: the helpers.
- `backend/src/issues/tests/issues-http-errors.spec.ts`: one case per helper (status, code, message, meta).
