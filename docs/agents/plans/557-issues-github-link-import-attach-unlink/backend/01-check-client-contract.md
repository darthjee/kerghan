# Check the #554 contract

Before writing any code, confirm that #554 has merged. Then read what it actually exports and align the names used in the later steps with it.

- Check `IntegrationsGithubService.getIssue(userId, integrationId, repo, number, etag?)` and its result union. This plan assumes the kinds `ok{issue, etag, renamedTo?}`, `not_modified`, `not_found`, `gone`, `moved`, `forbidden`, plus `RepoFailure`: `invalid_credentials`, `rate_limited{resetAt}`, `unavailable{reason}` and `integration_unusable{reason}`.
- Check the `issue` payload: `{ id, number, title, body, state, updatedAt, isPullRequest }`.
- Check that the types are re-exported from `integrations-github.public.ts`. If one is missing, add the re-export there. That is the only Integrations file Issues may import.
- Check the extended `FakeIntegrationsGithubService` (scripted answers per integration and operation, a call log, deferred answers) and the builders `githubIssue` and `githubPullRequest`. The tests in step 09 use them.
- If a merged name differs from this plan, use the merged one everywhere, and note the difference in the PR description. The specs do not change.

## Files to Change
- none (this step only reads code)
