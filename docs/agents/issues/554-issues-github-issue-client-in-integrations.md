## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`), and the specification phase is finished. The implementation issues were spawned by #492.

This issue builds the **GitHub issue client** inside the Integrations module. It is the only place that calls GitHub with a user's credential for issues. It adds two reads to `IntegrationsGithubService` and one write on a separate, exported `IntegrationsGithubIssueWriter`, together with the token, redirect and test-fixture work they need. The specs are the source of truth: this issue makes no product decision of its own beyond the clarifications recorded under *Decisions*. A change of decision updates the spec in the same PR (`docs/agents/specs.md`, lifecycle step 2).

## Builds against

- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/sync.md#github-issue-client-operations` (the operations and their payloads)
- `docs/agents/specs/issues/github-link.md#gone-transferred-and-repository-unreachable` (how `404`, `410` and `301` are classified)
- `docs/agents/specs/issues/security.md#write-access-to-github` (including `#the-github-app-gains-issues-write`) and `docs/agents/specs/issues/security.md#the-integrations-boundary` (reads and the one write are separate services, what the write may send, redirects)
- `docs/agents/specs/issues/testing.md#fixtures` (the extended fake, builders, the contract specs)
- `docs/agents/specs/issues/edge-cases.md`: E1 to E5, E19 to E22 and E65 (credential and GitHub outcomes)

## Task

### Operations

`repo` is `{ githubId, owner, name }`, taken from the repository row; `issue` is `{ id, number, title, body, state, updatedAt, isPullRequest }`. Every operation has the existing service shape: `(userId, integrationId, …)`, an owner-scoped integration load (`WHERE id = ? AND user_id = ?`), and `kind` unions that share `RepoFailure` (`invalid_credentials`, `rate_limited{resetAt}`, `unavailable{reason}` and `integration_unusable{reason}`).

| Operation | Service | Request | Success kinds | Issue-specific kinds (plus `RepoFailure`) |
|---|---|---|---|---|
| `getIssue(userId, integrationId, repo, number, etag?)` | `IntegrationsGithubService` | `GET /repos/{owner}/{name}/issues/{number}` | `ok{issue, etag, renamedTo?}`, `not_modified` | `not_found`, `gone` (`410`), `moved`, `forbidden` |
| `probeIssues(userId, integrationId, repo)` | `IntegrationsGithubService` | `GET /repos/{owner}/{name}/issues?per_page=1` | `ok` | `not_found`, `forbidden` |
| `updateIssue(userId, integrationId, repo, number, changes)` | `IntegrationsGithubIssueWriter` | `PATCH /repos/{owner}/{name}/issues/{number}` | `ok{issue, renamedTo?}` | `not_found`, `gone`, `moved`, `forbidden` |

- `IntegrationsGithubService` stays `GET`-only. `IntegrationsGithubIssueWriter` is the only service in the codebase that sends a non-`GET` request to GitHub with a user's credential.
- `forbidden` is its own kind (a `403` that is not a rate limit), not `unavailable{reason:'forbidden'}`.
- A `401` follows the existing rules: it invalidates a `pat` or `oauth_app` integration, and for a `github_app` it evicts the token and retries once.
- The path is built only from the stored `owner`, `name` and `number`, each URL-encoded, on the fixed base `https://api.github.com`.
- `changes` holds only `title?`, `body?` and `state?` (`open`/`closed`). The writer rejects any other field, and `state_reason`, before any call. The body sent is the diff it was given, never a full `PATCH`.
- Logs carry safe fields only: integration id, operation, HTTP status and result kind. They never carry a title, a body, a token or a URL.

### GitHub App token permissions

- `getIssue` and `probeIssues` mint installation tokens with `{ issues: read, metadata: read }`. `updateIssue` mints with `{ issues: write }`. The listings keep `{ metadata: read }`.
- The installation-token cache (`GithubInstallationTokenCache`) is keyed by installation **and** permission set, so a token is never reused across permission sets. Single-flight, the replace guard and `evict` keep working per entry; `evict(integrationId)` drops every permission set of that integration.

### Redirects

- No call follows a redirect automatically (`redirect: 'manual'`, as today).
- A `301` is a **rename** only when its `Location` is `https://api.github.com/repositories/{repo.githubId}/issues/{number}`: the same repository id and the same issue number, with no other scheme, host, port, query or path shape. The client retries once at that `Location`, with the same request (the write resends the same body), and the result carries `renamedTo: { owner, name }`. `renamed` itself never leaves the adapter.
- `renamedTo` is parsed from the followed answer's `repository_url` and validated. A missing or malformed value makes the result `unavailable{reason:'unexpected'}`.
- Any other `Location` on `https://api.github.com` is a **transfer**: `moved`.
- An unclassifiable `Location` (another scheme, host or port, or a malformed URL), or a second `301` in one call, is not followed, sends no credential, and answers `unavailable{reason:'redirect'}`.

### Test fixtures and contract specs

- **The fake.** `FakeIntegrationsGithubService` is extended with `getIssue`, `probeIssues` and `updateIssue`. It gets scripted answers per (integration, operation), including `not_modified` and the issue-specific kinds, a call log (so specs can assert "no GitHub call"), and deferred answers (a promise the spec resolves) for race specs. The fake covers the writer too, so Issues specs inject one fake for both services.
- **Builders.** Typed builders, with no recorded JSON: `githubIssue({ id, number, title, body, state, updatedAt })`, `githubPullRequest(...)` and `issuePage(...)`, which is the probe's listing body. The existing error builders are reused.
- **Fidelity contract spec.** Every builder case of each new operation runs through the real service at the `fetch` level, and its result must equal the fake's answer. The existing no-network guard covers the module.
- **Redirect and `Location` contract spec.** It records GitHub's `200`, `404`, `410` and `301` answers for `/repos/{owner}/{name}/issues/{number}`, including the rename `Location` form. The recorded cases run in CI.
  - An opt-in live mode runs the same cases against live GitHub. It runs only when an env var and a token are set, and is skipped otherwise.
  - The `Location` of a transferred issue stays a documented assumption ("any other target means moved") until someone runs the live mode and records it.
- **Writer boundary (static).** A spec next to the Repositories module-boundary tooling fails when any file outside Integrations injects `IntegrationsGithubIssueWriter`. Its allowlist is empty in #554, and #558 adds the issues sync service to it. A second check asserts that `IntegrationsGithubService` makes no non-`GET` call.

### Exports and docs

- Export the new types (the `repo` and `issue` shapes, `changes`, and the three result unions) and both services through `integrations-github.public.ts`, the only Integrations file Issues may import.
- In the same PR, update the module docs that describe today's code:
  - `docs/agents/modules/integrations/github-service.md`: the new operations, the writer, token minting per operation, and the cache key;
  - `docs/agents/modules/integrations/github-app/credentials.md`: the "Required permissions" section, which now lists Issues: write;
  - `docs/agents/architecture/security.md`: the `GET`-only guarantee, narrowed to the single writer.
- Update `sync.md#github-issue-client-operations` so that `repo` is `{ githubId, owner, name }` (see *Decisions*).

## Scope

In scope: the three operations, the writer, per-operation tokens and the cache key, redirect classification, the fake and the builders, the two contract specs, the writer boundary spec, the exports and the doc updates listed above.

Out of scope:

- Choosing an integration, ordering candidates, the credential fallback and the waiting sets: these belong to #557 (the resolver) and #558 (the paused-candidate skip and the waiting sets).
- What a caller does with `gone`, `moved`, `forbidden` or `renamedTo`, including handing a rename to Repositories (E65) and the E22 decision. #554 only answers the kinds; #557 and #558 act on them.
- Registering the GitHub App with Issues: write on GitHub. This is an operator action; #554 documents it in `credentials.md`.
- Listing issues for import. Import is by number (`api/github-link.md`).

## Decisions

These are clarifications made while refining, not product decisions.

- **`repo` carries `githubId`.** The rename check compares the repository id in the `Location`, so `repo` is `{ githubId, owner, name }`. `sync.md` is updated in the same PR.
- **The live contract mode is opt-in.** The recorded cases run in CI. The live run is on demand, and the transfer `Location` remains an assumption until it is recorded.
- **The writer allowlist is empty.** The issues sync service is added to it by #558.
- **`renamedTo` is `{ owner, name }`**, parsed from the followed answer.

## Depends on

None. It can start at once. #557 is planned against this contract and its implementation waits for #554 to merge.

## Acceptance criteria

- The Required tests of every spec file listed under *Builds against* that belong to the client are implemented, each on the tier given by [`testing.md`](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs/issues/testing.md) (default tier by category, and the coverage per area). These include:
  - each kind of the operations table, including a rename handled inside the adapter (unit);
  - a `301` to another host, scheme or port that is not followed and sends no credential (contract and unit);
  - the writer sending only `title`, `body` and `state` and rejecting any other field before a call;
  - the per-operation token permissions, with no reuse across permission sets.
- Every builder case of each new operation, run through the real service at the `fetch` level, equals the fake's answer, and the no-network guard covers the module.
- The redirect and `Location` contract spec passes on the recorded cases, and its live mode is skipped unless enabled. No credential leaves GitHub's hosts.
- The writer boundary static spec passes with an empty allowlist, and `IntegrationsGithubService` has no non-`GET` call.
- No decision differs from the specs; where one does (`repo.githubId`), the spec is updated in the same PR.
- The checks of the owning agent pass (through `docker-compose`).

## Notes

Responsible agent: `backend` (Integrations module). Review: `security` (new outbound GitHub calls, token use, redirects) and `data-access`.
