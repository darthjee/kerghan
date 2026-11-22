# Contract specs (fidelity, redirect and Location)

## Fidelity contract

Extend `integrations-github.contract.spec.ts` with rows for `getIssue`, `probeIssues` and `updateIssue`. Every builder case of step 07 that applies to an operation runs through the real service (or the writer) at the `fetch` level, with the no-network guard installed, and its result must `toEqual` the fake's answer for the same case.

- **Cases covered:** `issue`, `githubPullRequest`, `issuePage`, `notModified`, `rateLimited`, `unauthorized`, `forbidden`, `notFound`, `issueGone`, `issueRenamed`, `issueMoved`, `issueRedirectOffHost`, `timeout`, `serverError` and `integrationUnusable`.
- **Integration types:** run the authenticated rows for a `pat` integration and, where the token rules differ, a `github_app` integration through the harness. A `github_app` `401` follows the retry rule.
- **Requests:** assert the method and path of every `fetch` call:
  - `GET` for the reads, `PATCH` for the write;
  - owner and name URL-encoded;
  - the `PATCH` body equal to the given diff;
  - a single `fetch` for `issueRedirectOffHost`;
  - for `issueRenamed`, exactly two `fetch` calls, the second to `https://api.github.com/repositories/{id}/issues/{n}`.

## Redirect and `Location` contract spec

Create `backend/src/integrations/tests/github-issue-redirect.contract.spec.ts`.

- **Recorded mode (CI).** It replays GitHub's recorded `200`, `404`, `410` and `301` answers for `/repos/{owner}/{name}/issues/{number}`, as typed raw responses in the spec, with no recorded JSON files. The recorded `301` uses the rename `Location` form (`https://api.github.com/repositories/{id}/issues/{n}`).
- **What it asserts:**
  - each answer's outcome;
  - a rename is followed once;
  - a `Location` on another host (for example `https://evil.example/...`), scheme (`http://api.github.com/...`) or port (`https://api.github.com:8443/...`), or with credentials in the URL, is not followed;
  - no `fetch` call ever carries `Authorization` to a URL whose origin is not `https://api.github.com`. Assert this over the full `fetchCalls()` log.
- **Live mode (opt-in).**
  - A separate `describe` runs only when `KERGHAN_GITHUB_CONTRACT_LIVE=1`, with `KERGHAN_GITHUB_CONTRACT_TOKEN` and `KERGHAN_GITHUB_CONTRACT_REPO` (`owner/name`, plus the issue numbers to read) set. Otherwise it is `describe.skip`.
  - It removes the no-network guard for its own block only.
  - It calls the real `GithubIssueClientService` and checks that the live answers have the recorded shapes.
  - It logs the `Location` of a transferred issue when one is configured, so the assumption can be recorded.
  - Document it in the spec header, and in `docs/agents/modules/integrations/github-service.md` (step 10).
- **The assumption.** The spec header states that the transfer `Location` is not yet observed, and that "any other `api.github.com` target means moved" is an assumption until the live mode records one.

## Files to Change
- `backend/src/integrations/tests/integrations-github.contract.spec.ts` — the issue operation rows.
- `backend/src/integrations/tests/github-issue-redirect.contract.spec.ts` — new: recorded and live-opt-in modes.
- `backend/src/integrations/tests/support/integrations-github-harness.ts` — expose the writer and the issue client to the specs.
- `backend/src/integrations/tests/support/no-network-guard.ts` — a scoped opt-out for the live block, if the guard has no such hook yet.
