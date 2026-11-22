# Candidate resolver and GitHub issue reader

Build the integration selection of `sync.md#integration-selection` for the single read of link creation. Build it as a reusable service, because #558 reuses it.

## Inputs from the other modules (exported entry points only)

- **Repositories:** add `RepositoriesService.integrationSourceIds(userId, repositoryId): Promise<number[]>`. It returns the ids of the user's integrations whose source lists the repository, from `repositories_sources` rows whose `source_key` is `integration:<id>`. A `handle:` source is never returned, because a handle alone is not a candidate (E20). It is one indexed query. Document it in `docs/agents/modules/repositories.md` next to `resolveForProject` and `projectSummaries`.
- **Integrations:** the order needs each integration's *known write capability*. Add `issuesWrite: 'writable' | 'unknown' | 'read_only'` to `IntegrationRef`, derived inside Integrations:
  - OAuth app and classic PAT: `writable`;
  - fine-grained PAT: `unknown`;
  - GitHub App: from the recorded installation `permissions.issues`, `write` meaning `writable` and anything else `read_only`.

  `listUsableIntegrations` and `listIntegrations` both carry it. Re-export nothing new beyond the changed type. Update `docs/agents/modules/integrations/github-service.md` with the new field.

## `IssueCandidates` (`issues/issue-candidates.ts`)

`resolve(userId, repositoryId)` returns either `{ kind: 'candidates', ids: number[] }` (ordered) or `{ kind: 'none', reason: 'no_credential' | 'credential_invalid' }`.

1. `sourceIds = integrationSourceIds(...)`, `usable = listUsableIntegrations(userId)` and `all = listIntegrations(userId)`.
2. The candidates are the usable integrations whose id is in `sourceIds`.
3. They are ordered by group (`writable`, then `unknown`, then `read_only`) and, inside each group, oldest first. `listUsableIntegrations` already returns them oldest first, so the sort must be stable.
4. With no candidate: the reason is `credential_invalid` when some integration in `all` lists the repository but is not usable, and `no_credential` otherwise.

Nothing stores an integration id. The resolver runs on every call.

The doc comment says that #558 reuses it and adds the paused-candidate skip.

## `IssueGithubReader` (`issues/issue-github-reader.ts`)

`readForLink(userId, repo: { owner, name }, repositoryId, number)` walks the candidates and returns a normalized outcome, so the service never sees status codes:

- `{ kind: 'ok', issue, etag, integrationId }`;
- `{ kind: 'not_found' }`, covering `not_found`, `gone` and `moved` (E57);
- `{ kind: 'rate_limited', retryAfterSeconds }`, computed from `resetAt` against the `Clock`, at least 1, or `null` when unknown (E58);
- `{ kind: 'credential', reason }` (E59);
- `{ kind: 'unavailable' }`, covering `unavailable`, which includes an unclassifiable `301` (E60).

How the walk works:

- It never sends an etag on link creation, so `not_modified` cannot happen. If it does, treat it as `unavailable`.
- **Fallback on credential failures only:**
  - `invalid_credentials` (the client has already marked the integration invalid);
  - `forbidden` (a non-rate-limit `403`);
  - `integration_unusable`.

  On any of these, try the next candidate.
- A rate limit, `unavailable`, `not_found`, `gone` or `moved` ends the walk at once.
- When every candidate failed on credentials, the reason is `forbidden` if any of them answered `forbidden`, otherwise `credential_invalid`.
- `none` from the resolver maps to `credential` with that reason, and no GitHub call is made.
- A `renamedTo` hint on `ok` is ignored. #558 owns the hand-off (E65).
- Logs carry the integration id and the outcome kind only.

## Files to Change
- `backend/src/repositories/repositories.service.ts` (plus the store or query it delegates to): `integrationSourceIds`.
- `backend/src/integrations/github-repo-results.ts` and `integrations-github.service.ts`: `IntegrationRef.issuesWrite`.
- `backend/src/issues/issue-candidates.ts` and `issue-github-reader.ts`: new.
- `backend/src/issues/tests/support/fake-project-repositories.ts`: add `integrationSourceIds` to the fake surface.
- `docs/agents/modules/repositories.md` and `docs/agents/modules/integrations/github-service.md`: document the new method and the new field.
- Specs:
  - `issues/tests/issue-candidates.spec.ts`: groups, oldest first within a group, handle-only meaning `no_credential`, a not-usable source meaning `credential_invalid`, none meaning `no_credential`;
  - `issue-github-reader.spec.ts`: the outcome mapping, the credential-only fallback, no fallback on a rate limit, `5xx` or `not_found`, the aggregate reason, and no call when there are no candidates;
  - the Repositories db spec for `integrationSourceIds`;
  - the Integrations spec for `issuesWrite` on each type.
