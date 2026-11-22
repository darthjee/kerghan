# Per-operation tokens and the cache key

Mint each GitHub App installation token with the least permission its operation needs, and never reuse a token across permission sets (`security.md#the-github-app-gains-issues-write`).

- **Permission sets.** Define an `InstallationPermissionSet` with three named sets:
  - `REPO_LISTING_PERMISSIONS = { metadata: 'read' }`, today's `INSTALLATION_TOKEN_PERMISSIONS`, renamed and kept for the listings;
  - `ISSUE_READ_PERMISSIONS = { issues: 'read', metadata: 'read' }`, for `getIssue` and `probeIssues`;
  - `ISSUE_WRITE_PERMISSIONS = { issues: 'write' }`, for `updateIssue`.

  Each set has a stable key string (for example `metadata:read`, `issues:read,metadata:read` and `issues:write`).
- **`GithubRepoClientService.mintInstallationToken(jwt, installationId, permissions)`** sends the given set in the body. The existing callers pass the listing set.
- **`GithubInstallationTokenCache`:**
  - `InstallationTokenKey` gains `permissions`;
  - the entry and in-flight maps are keyed by `${integrationId}|${permissionKey}`;
  - `matchesKey` also compares the permission key;
  - single-flight and the replace guard apply per entry;
  - `evict(integrationId)` drops every entry and in-flight mint of that integration, across all permission sets, and bumps its generation. The generation stays per integration.
- **`GithubAppRepoCaller.call(target, call)`:**
  - the target gains `permissions`;
  - `#mint` passes them through;
  - the cache key carries them;
  - the result generic widens to cover the issue result unions from step 01;
  - the `401` and retry rules are unchanged.

Update the existing specs (`github-installation-token-cache.spec.ts`, `github-app-client.service.spec.ts` and any caller of the mint) to the new signature. Add cases:

- a read token and a write token for the same installation are two mints and two entries;
- a read never gets the write token, and the write never gets the read token;
- `evict` drops both.

## Files to Change
- `backend/src/integrations/github-repo-client.service.ts` — the named permission sets; `mintInstallationToken` takes `permissions`.
- `backend/src/integrations/github-installation-token-cache.ts` — the key includes the permission set; `evict` clears every set.
- `backend/src/integrations/github-app-repo-caller.ts` — the target carries `permissions`; the generic covers the issue results.
- `backend/src/integrations/tests/github-installation-token-cache.spec.ts` — the per-permission-set cases.
- `backend/src/integrations/tests/github-repo-client.service.spec.ts`, `backend/src/integrations/tests/github-app-client.service.spec.ts` — the signature updates and a mint-body assertion per set.
