# The issue HTTP client

Add the internal HTTP half of the issue operations. It is never exported; only the services of step 06 call it.

Create `backend/src/integrations/github-issue-client.service.ts`, `GithubIssueClientService` (injecting `Clock`). Every method returns a `RepoCall<T>` (`result`, `rateLimit`, `status`), goes through `send` with `redirect: 'manual'` and the step 02 caps, and uses `apiHeaders`.

- **`getIssue(token, repo, number, etag?)`** sends `GET /repos/{owner}/{name}/issues/{number}`, with `If-None-Match` when it has an etag. A `200` is `ok{issue, etag}`, with `etag` taken from the `ETag` header or `null`.
- **`probeIssues(token, repo)`** sends `GET /repos/{owner}/{name}/issues?per_page=1`. A `200` is `ok`.
- **`updateIssue(token, repo, number, changes)`** sends `PATCH /repos/{owner}/{name}/issues/{number}` with `Content-Type: application/json` and a body built **only** from `title`, `body` and `state`. A `200` is `ok{issue}`.
  - The body is built by copying the three fields explicitly; the input object is never spread.
  - It throws before any call when `changes` has any other own key (`state_reason` included), when `state` is not `open`/`closed`, or when `changes` is empty. The writer (step 06) validates first, so this is a second guard.

**Path.** `owner` and `name` go through `encodeURIComponent`. `number` and `githubId` must be safe positive integers, or the method throws a `RangeError`, as `getRepositoryById` does. The base is always `GITHUB_API_URL`.

**Redirects.** On a `301`, `302`, `307` or `308`, the client calls `classifyIssueRedirect` (step 03):

- `renamed`: retry once at the rebuilt URL with the same method, headers and body. Track the hop count, so that a second redirect in the same call is `unavailable{redirect}` and is not followed. A successful retry adds `renamedTo` from `parseRenamedTo` on the issue body. When `parseRenamedTo` fails, the result is `unavailable{unexpected}`.
- `moved`: return `moved`. The probe never sees one: a `3xx` on the probe is `unavailable{redirect}`.
- `unclassifiable`: return `unavailable{redirect}`, with no second request, so no credential is sent anywhere else.

**Errors.** A thrown `GithubClientError` is `unavailable{timeout|network_error}`, as in `GithubRepoClientService`.

Register the client in `IntegrationsModule`'s providers, but not in its exports.

## Files to Change
- `backend/src/integrations/github-issue-client.service.ts` — new: `GithubIssueClientService`.
- `backend/src/integrations/integrations.module.ts` — add the client to the providers.
