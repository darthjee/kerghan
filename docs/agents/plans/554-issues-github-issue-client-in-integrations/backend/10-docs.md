# Docs and the spec update

The specs say the module docs describing today's code are updated in the change that builds the client. Update them in this PR:

- **`docs/agents/modules/integrations/github-service.md`:**
  - the exported operations gain `getIssue` and `probeIssues`, with their result tables;
  - a new section covers `IntegrationsGithubIssueWriter` and `updateIssue`: the body allowlist, the path from stored rows, the only non-`GET` call, and the boundary spec;
  - installation tokens: the per-operation permission sets, and the cache keyed by integration and permission set, with `evict` clearing all of them;
  - redirects: the rename, moved and unclassifiable classification, and the single follow;
  - the redirect contract spec, with how to run its live mode (the env vars) and the open transfer-`Location` assumption.
- **`docs/agents/modules/integrations/github-app/credentials.md`:**
  - "Required permissions" becomes Issues: write and Metadata: read;
  - installations with `issues: read` are still accepted, and their pushes answer `forbidden`;
  - the operator note: the registered app must be updated on GitHub, and each installation owner accepts the new permission.
- **`docs/agents/architecture/security.md`:** narrow the "Fixed operations: `GET`-only" guarantee to "`GET`-only, except the single `IntegrationsGithubIssueWriter.updateIssue`", and link `specs/issues/security.md#the-integrations-boundary`.
- **`docs/agents/modules/repositories/testing.md`**, if it documents `FakeIntegrationsGithubService`'s surface: mention the issue operations and the builders.
- **`docs/agents/specs/issues/sync.md#github-issue-client-operations`:**
  - `repo` is `{ githubId, owner, name }` from the repository row, because the rename check compares the repository id;
  - the success kinds become `ok{issue, etag, renamedTo?}` and `ok{issue, renamedTo?}`, with `renamedTo` as `{ owner, name }`.

  Keep the rest of the section unchanged.

## Files to Change
- `docs/agents/modules/integrations/github-service.md` — the issue operations, the writer, tokens, redirects and the contract spec.
- `docs/agents/modules/integrations/github-app/credentials.md` — Required permissions, and the operator note.
- `docs/agents/architecture/security.md` — the narrowed `GET`-only guarantee.
- `docs/agents/modules/repositories/testing.md` — the fake's surface (if documented there).
- `docs/agents/specs/issues/sync.md` — `repo.githubId` and `renamedTo`.
