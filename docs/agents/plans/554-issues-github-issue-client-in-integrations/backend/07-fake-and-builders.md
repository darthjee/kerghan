# The fake and the builders

Extend the typed fixtures so the Issues specs (#557, #558) never touch `fetch` (`testing.md#fixtures`).

## Builders (`github-builders.ts`, raw bodies in `github-raw.ts`)

- `GithubOperation` gains `'getIssue'`, `'probeIssues'` and `'updateIssue'`. `resultFor` widens to also return `IssueResult`, `IssueProbeResult` and `IssueUpdateResult`.
- Add these builders:
  - **`githubIssue({ id, number, title, body, state, updatedAt })`** — a typed `GithubIssue`. Ids default above 2³¹, as for repos.
  - **`githubPullRequest(...)`** — the same, with `isPullRequest: true`. Its raw body carries a `pull_request` member (E3).
  - **`issue(githubIssue, { etag })`** — a case answering `200` with the raw issue (`rawIssue`) and the `ETag`.
  - **`issuePage(issues)`** — a case answering the probe's `200` array.
  - **`issueGone()`** — a case answering `410`.
  - **`issueRenamed(repo, number, githubIssue, renamedTo)`** — a case whose raw answer is a `301` to `/repositories/{id}/issues/{n}`, followed by the `200`. It is a two-reply case, built with `replyOnce`, or with a new sequence form of `raw`.
  - **`issueMoved(location?)`** — a case answering `301` to another `api.github.com` path.
  - **`issueRedirectOffHost(location)`** — a case answering `301` to another host, scheme or port. Its result is `unavailable{redirect}`.
- Reuse the error builders (`rateLimited`, `unauthorized`, `forbidden`, `notFound`, `notModified`, `timeout`, `serverError`, `integrationUnusable`), extending each one's `resultFor` for the issue operations:
  - `forbidden` is `forbidden` for the issue operations, not `unavailable{forbidden}`;
  - `notModified` is `unexpected` for the probe and the write.
- Document in the builders' header:
  - a deleted issue is `notFound` plus a passing `issuePage` probe (E1, E22);
  - a transferred issue is `issueMoved` (E2, E65);
  - a failing probe is `notFound` or `forbidden` on `probeIssues`.

## The fake (`fake-integrations-github.service.ts`)

- `FakeIntegrationsGithubService` also implements `getIssue`, `probeIssues` and `updateIssue`, so one fake stands in for both `IntegrationsGithubService` and `IntegrationsGithubIssueWriter`. It gains an `asWriter()` accessor, typed as `Pick<IntegrationsGithubIssueWriter, 'updateIssue'>`, for Nest overrides.
- The script slot for the issue operations is the issue `number`, and `0` for the probe. `script(integrationId, operation, slot | '*', ...answers)` and `hold(...)` work unchanged.
- `FakeCall` gains `repo` (the `{ githubId, owner, name }` passed), `number` and `changes` (the `updateIssue` diff, copied), so specs can assert that the `PATCH` carried only the diff. `githubCalls()` includes the three new operations.
- The fake validates `changes` with the same allowlist as the writer, and throws the same `TypeError`, so a spec cannot pass with a payload the real writer would refuse.

## Files to Change
- `backend/src/integrations/tests/support/github-raw.ts` — `rawIssue`, `rawPullRequest` and the redirect responses.
- `backend/src/integrations/tests/support/github-builders.ts` — the issue operations and builders; the error builders extended.
- `backend/src/integrations/tests/support/fake-integrations-github.service.ts` — the three operations, the logged fields, `asWriter()` and the allowlist check.
