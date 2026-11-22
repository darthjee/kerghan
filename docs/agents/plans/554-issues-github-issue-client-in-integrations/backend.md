# Backend Plan: Issues: GitHub issue client in Integrations

Main plan: [plan.md](plan.md)

## Overview

This plan builds the only code that calls GitHub with a user's credential for issues:

- the reads `getIssue` and `probeIssues`, on `IntegrationsGithubService`;
- the single write `updateIssue`, on a new `IntegrationsGithubIssueWriter`;
- the GitHub App token permissions per operation, and a token cache keyed by permission set;
- the redirect rule (follow a rename once; never send a credential off `api.github.com`);
- the fixtures and specs that #557 and #558 build on.

It makes no product decision. The only spec change is `repo` gaining `githubId` in `sync.md`, as decided in the issue.

## Context

- The specs are `docs/agents/specs/issues/sync.md#github-issue-client-operations`, `github-link.md#gone-transferred-and-repository-unreachable`, `security.md#write-access-to-github`, `security.md#the-integrations-boundary` and `testing.md#fixtures`. The edge cases are E1 to E5, E19 to E22 and E65.
- **Existing shape to follow:**
  - `IntegrationsGithubService` (`backend/src/integrations/integrations-github.service.ts`) loads the integration owner-scoped, checks usability, decrypts, and routes `github_app` through `GithubAppRepoCaller`. It handles a `401` per type and logs safe fields.
  - `GithubRepoClientService` sends with `redirect: 'manual'` through `send` (timeout and body cap) and classifies through `github-repo-response.ts`.
  - `GithubInstallationTokenCache` is keyed by integration id only, and `mintInstallationToken` always asks for `{ metadata: read }`.
- **Fixtures to extend:**
  - `FakeIntegrationsGithubService`, which already has scripting, a call log and `hold` deferreds;
  - `github-builders.ts`, whose `GithubCase` has a raw `fetch` answer plus `resultFor(operation)`;
  - `integrations-github.contract.spec.ts`, the fidelity spec;
  - `no-network-guard.ts`.
- **Public surface:** `integrations-github.public.ts` is the only Integrations file other modules may import (enforced by ESLint for Repositories and Issues).
- **Decisions recorded in the issue:**
  - `repo` is `{ githubId, owner, name }`;
  - the live contract mode is opt-in;
  - the writer allowlist is empty;
  - `renamedTo` is `{ owner, name }`.

## Steps

- [01 — Issue types and results](backend/01-issue-types-and-results.md)
- [02 — Issue response parsing and classification](backend/02-issue-response-classification.md)
- [03 — Redirect classification](backend/03-redirect-classification.md)
- [04 — Per-operation tokens and the cache key](backend/04-token-permissions-and-cache-key.md)
- [05 — The issue HTTP client](backend/05-issue-http-client.md)
- [06 — Shared authenticated runner, the reads and the writer](backend/06-services-and-writer.md)
- [07 — The fake and the builders](backend/07-fake-and-builders.md)
- [08 — Contract specs (fidelity, redirect and Location)](backend/08-contract-specs.md)
- [09 — Unit and static specs](backend/09-unit-and-static-specs.md)
- [10 — Docs and the spec update](backend/10-docs.md)

## CI Checks

Run everything through `docker-compose`, never on the host:

- `backend`: `yarn test` / `yarn coverage` (CI job: `backend_tests`)
- `backend`: `yarn test:db` against MySQL (CI job: `backend_db_tests`). There are no new DB specs, but the existing ones must stay green after the token cache change.
- `backend`: `yarn lint` (CI job: `backend_checks`)

## Notes

- **Reviews:** the `security` agent reviews the new outbound calls, the write, token permissions and redirects. The `data-access` agent reviews the owner-scoped loads and the exported shapes. Both review against `docs/agents/specs/issues/security.md#review-checklist`.
- **Nothing sensitive in results or logs:**
  - no token, `secret_iv`, URL, `Location`, title, body or GitHub error body appears in any result or log line;
  - logs carry the integration id, operation, HTTP status and result kind only.
- **`github_app` `401` rule unchanged:** a cached token's `401` evicts it and retries once, and a fresh token's `401` answers `unavailable{unexpected}`. `evict` now drops every permission set of the integration.
- **Rename and the write:** a followed rename on the write resends the same body (idempotent fixed values). A second `301` in one call is `unavailable{redirect}`.
- **Transfer `Location`:** "any other `api.github.com` target means moved" stays an assumption until the live contract mode records a transferred issue. A comment in the classifier and in the contract spec says so.
- **Consumers:** #557 already plans against `ok{issue, etag, renamedTo?}` and the kinds of the issue table. If a name has to differ, keep the #557 plan's names or update that plan in this PR.
- **Out of scope:**
  - candidate selection and order, the credential fallback and the waiting sets (#557, #558);
  - acting on `gone`, `moved`, `forbidden` or `renamedTo`, and the E22 decision (#557, #558);
  - registering the GitHub App with Issues: write on GitHub (an operator action, documented in step 10);
  - any issue listing for import.
