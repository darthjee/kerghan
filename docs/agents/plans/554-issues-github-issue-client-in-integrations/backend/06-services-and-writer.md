# Shared authenticated runner, the reads and the writer

The reads and the write need the same authenticated path: an owner-scoped load, the usability check, decryption, `github_app` through the caller, the `401` handling, and safe logs. Extract that path once, so the writer does not copy it and does not depend on the read service.

- **`GithubAuthenticatedRunner`** (internal, in `backend/src/integrations/github-authenticated-runner.ts`) receives the bodies of today's `#authenticated`, `#withToken` and `#unusableReason`, plus `#log` and the `BAD_CREDENTIALS_REASONS` table, moved out of `IntegrationsGithubService` unchanged.
  - Its signature is `run(userId, integrationId, operation, permissions, call: (token, type) => Promise<RepoCall<T>>)`.
  - It passes `permissions` to `GithubAppRepoCaller`.
  - The result generic covers both the repo and the issue result unions.
  - The integration is still loaded with `WHERE id = ? AND user_id = ?` (`findOwnedById`). A missing, foreign or non-usable integration answers `integration_unusable` with no call.
  - `#log` treats `ok`, `not_modified` and `not_found` as quiet. Every other kind, `gone`, `moved` and `forbidden` included, logs `{ integrationId, operation, status, result }`.
- **`IntegrationsGithubService`:**
  - uses the runner (listings with `REPO_LISTING_PERMISSIONS`), with no behaviour change;
  - `listUsableIntegrations` stays here, and `#unusableReason` is shared through the runner;
  - adds `getIssue(userId, integrationId, repo, number, etag?)` and `probeIssues(userId, integrationId, repo)`, both with `ISSUE_READ_PERMISSIONS`, through `GithubIssueClientService`.

  There is no unauthenticated variant: `integrationId` is a `number`, and the issue operations never use the unauthenticated budget.
- **`IntegrationsGithubIssueWriter`** (new, `backend/src/integrations/integrations-github-issue-writer.service.ts`) has a single method, `updateIssue(userId, integrationId, repo, number, changes)`.
  - It validates `changes` first: only `title`, `body` and `state` may be own keys, `state` must be `open` or `closed`, `title` must be a string and `body` a string or `null`, and at least one field must be present.
  - Anything else throws a `TypeError`, with a fixed message that never echoes a value, before any load or call.
  - It then runs through the runner with `ISSUE_WRITE_PERMISSIONS` and `GithubIssueClientService.updateIssue`.
  - Its doc comment says it is the only non-`GET` GitHub call made with a user's credential, and that only the issues sync service may inject it (#558).
- **Module and exports:**
  - add the runner and the writer to `IntegrationsModule`'s providers, and export `IntegrationsGithubIssueWriter` beside `IntegrationsGithubService`;
  - re-export both services from `integrations-github.public.ts` and update its header comment.

## Files to Change
- `backend/src/integrations/github-authenticated-runner.ts` — new: the shared authenticated path.
- `backend/src/integrations/integrations-github.service.ts` — use the runner; add `getIssue` and `probeIssues`.
- `backend/src/integrations/integrations-github-issue-writer.service.ts` — new: `IntegrationsGithubIssueWriter`.
- `backend/src/integrations/integrations.module.ts` — providers and exports.
- `backend/src/integrations/integrations-github.public.ts` — re-export the writer; update the comment.
- `backend/src/integrations/tests/support/integrations-github-harness.ts` — build the runner, the issue client and the writer for the specs.
