# Integrations — GitHub service: API, endpoints and installation tokens

Part of the [GitHub service](../github-service.md) of the [Integrations module](../../integrations.md).

## Exported service

The Integrations module exports **`IntegrationsGithubService`** (from `IntegrationsModule`), with
fixed, `GET`-only operations; there is no generic `request(path)`:

```ts
// Oldest first (created_at, then id); filtered by userId in the query.
listUsableIntegrations(userId): Promise<IntegrationRef[]>   // { id, uuid, label, type, issuesWrite }
listIntegrations(userId): Promise<IntegrationRef[]>         // every one, usable or not; same fields

listRepositories(userId, integrationId, page, etag?): Promise<RepoPageResult>
listHandleRepositories(userId, integrationId | null, handle, page, etag?): Promise<RepoPageResult>
getRepository(userId, integrationId | null, githubId): Promise<RepoResult>

// Issues (see issues.md): reads only; the write is on IntegrationsGithubIssueWriter
getIssue(userId, integrationId, repo, number, etag?): Promise<IssueGetResult>
probeIssues(userId, integrationId, repo): Promise<IssueProbeResult>
```

- **Entry point:** other modules import from `integrations/integrations-github.public.ts` only. It
  re-exports `IntegrationsModule`, `IntegrationsGithubService`, its typed results, the
  `integration.deleted` event ([deletion hook](add-and-deletion.md#deletion-hook)) and **one extra export, the pure
  `walkAddCandidates(input, getRepository)`** ([Add re-check candidates](add-and-deletion.md#add-re-check-candidates)).
  The walk needs to know which integrations hold a source row, which only Repositories knows, so
  Repositories computes its inputs and maps its outcome to HTTP answers, while the walk itself
  (order, 3-call cap, stop and link rules) stays here; the real service and the typed fake share
  it.

- **`issuesWrite`** (added by #557) is the integration's *known write capability*, derived inside
  the module from its type and metadata and used only to order the issue candidates
  ([integration selection](../../issues/sync.md#integration-selection)), never as a gate:
  `writable` for an OAuth app and a classic PAT; `unknown` for a fine-grained PAT (GitHub does not
  expose its permissions); for a GitHub App, `writable` when the recorded installation
  `permissions.issues` is `write` and `read_only` otherwise. It carries no metadata.

- **`listIntegrations`** (added by #463) lists every one of the user's integrations, usable or
  not, oldest first, with the same allowlisted `IntegrationRef` fields and no GitHub call. The sync
  uses it for the non-usable integrations' sources ([sync](../../repositories/sync.md#sources)), the end-of-sync
  safety net and the link fill's dangling-link check; the listing and the sync state use it for
  the sources' `uuid` / `label` and to read a dangling link as empty.

- **Integration identity:** callers pass the internal `integrations.id` (the logical FK the
  Repositories tables already store, [data model](../../repositories/data-model.md#logical-foreign-keys)). Every call loads
  it with `WHERE id = ? AND user_id = ?`; a missing or foreign one answers
  `integration_unusable` with reason `missing` and **no GitHub call**. `null` means unauthenticated
  ([unauthenticated calls](#unauthenticated-calls)).
- **Typed, normalised results**, never a raw `Response`:

  ```ts
  type RepoPageResult =
    | { kind: 'ok'; repos: GithubRepo[]; etag: string | null; hasNext: boolean; rateLimit: RateLimitFields }
    | { kind: 'not_modified'; rateLimit: RateLimitFields }   // 304: the caller reuses its stored has_next
    | { kind: 'not_found' }                                  // handle listing only: unknown / renamed / suspended / deleted handle
    | { kind: 'invalid_credentials' }                        // 401: the integration is already set invalid
    | { kind: 'rate_limited'; resetAt: Date | null }
    | { kind: 'unavailable'; reason: 'timeout' | 'network_error' | 'server_error' | 'redirect' | 'forbidden' | 'unexpected' }
    | { kind: 'integration_unusable'; reason: 'status' | 'type_disabled' | 'missing' }; // not usable, type disabled, or missing / foreign

  type RepoResult =
    | { kind: 'ok'; repo: GithubRepo }
    | { kind: 'not_found' }
    | /* the same failure kinds as RepoPageResult */;

  type GithubRepo = { githubId: number; owner: string; name: string; private: boolean };
  ```

- `GithubRepo` carries only the model's fields. Each entry is validated (`githubId` a positive
  integer below 2⁵³, `owner` ≤ 39 and `name` ≤ 100 characters); malformed entries are dropped,
  as `GET /user/installations` entries are today.
- **Pagination:** the service builds every page URL from `page` itself
  (`?per_page=100&page=N`); `hasNext` is whether `Link` has a `rel="next"`, whose URL is never
  used ([security](../../repositories/security.md#fixed-github-base-url)).
- **Conditional requests:** a passed `etag` is sent as `If-None-Match`; the response's `ETag`
  and `X-RateLimit-*` come back in the result ([sync](../../repositories/sync/github-limits.md#conditional-requests)).
- Every request has the existing 10 s timeout ([sync](../../repositories/sync/github-limits.md#values)).
- **Credentials, minted installation tokens and GitHub response bodies never leave the module**:
  the Repositories module never sees, stores or logs them
  ([security](../../../architecture/security.md#github-credentials-stay-in-the-backend)).
- Integration types in scope: `pat`, `oauth_app`, `github_app`.
- The handle source's credential walk (oldest usable integration, the next one after a `401`,
  then unauthenticated; no fallback on a rate limit, timeout or `5xx`) is the sync's, built on
  `listUsableIntegrations` ([sync](../../repositories/sync.md#handle-credential)).

### Unauthenticated calls

**Every GitHub call of the feature, authenticated or not, goes through the Integrations module's
GitHub client.**

- `integrationId: null` on `listHandleRepositories` / `getRepository` sends the request with no
  `Authorization` header.
- The process-wide [unauthenticated budget tracker](add-and-deletion.md#unauthenticated-budget-tracker) lives next
  to that client, inside Integrations. Callers (the sync, Add's re-check) only see its effect: an
  unauthenticated call under the threshold answers `rate_limited` without calling GitHub.
- Why: `GithubClientService` is already "the only place in the backend that calls GitHub", with
  the safeguards (no redirects, timeout, body cap, pinned API version) and the single seam tests
  fake. A second client in Repositories would duplicate both and split the tracker's home.
  Repositories holds no HTTP code; it only consumes typed results.

### Endpoints and parameters

Every listing adds `per_page=100&page=N` (URL built by the client, never taken from a response),
with the already-pinned `Accept` and `X-GitHub-Api-Version` headers.

| Source | Auth | Endpoint |
|---|---|---|
| `pat`, `oauth_app` | `Bearer <token>` | `GET /user/repos?affiliation=owner,collaborator,organization_member&visibility=all&sort=created&direction=asc` |
| `github_app` | `Bearer <installation token>` | `GET /installation/repositories` (body `{ total_count, repositories: [...] }`; no sort parameter) |
| Handle | oldest usable integration, or none | `GET /users/{handle}/repos?type=owner&sort=created&direction=asc` (handle URL-encoded) |
| Add re-check | the access integration, or none | `GET /repositories/{githubId}` |

- **`sort=created&direction=asc`** rather than the default `full_name`: with page-number
  pagination a new repo lands on the last page, so earlier pages keep their ETag (`304`); a name
  sort would shift every page boundary on any creation or rename. Deletions still shift pages,
  which the sync's page rewrite already handles ([sync](../../repositories/sync/write-path.md#write-path)).
- **Explicit `affiliation` / `visibility`** (GitHub's defaults) pin the meaning: private and
  organization repos included. A fine-grained PAT returns only the repos it was granted; an OAuth
  App sees an organization's private repos only once that organization approved it
  ([oauth-app.md](../oauth-app.md)).
- **Handle `type=owner`:** the handle's own repos only. The handle source still keeps only
  `private: false` ([sync](../../repositories/sync.md#sources)).
- **Field mapping:** `id` → `githubId`, `owner.login` → `owner`, `name`, `private`; the rest of the
  body is discarded.
- **Body cap:** 2 MiB for repo listings (a page of 100 repo objects is ~0.5–1 MB, over today's
  64 KiB `GET /user` cap); 64 KiB for `GET /repositories/{id}`. Over the cap → `unavailable`
  (`unexpected`).

### GitHub App installation tokens

Minting per request (today's [github-app.md](../github-app.md) rule)
would double the calls of a sync (up to 10 pages per source, plus the handle and Add re-checks)
and spend the app JWT's rate limit. So repo calls use an **in-memory cache inside the
Integrations module**:

- **Key and lifetime:** keyed by `integrations.id` **and the permission set** (recording its
  `installationId`), so a token is never reused across permission sets; a token is
  reused until **`expires_at` − 5 min** (GitHub's tokens last 1 h). Held in a `Secret`, in
  process memory only — never in the database, a log or a response. Expired entries are dropped
  on read; at most one entry per `github_app` integration and permission set, so no LRU.
- **Time:** the "`expires_at` − 5 min" check reads the injected `Clock` (`core/clock.ts`, shared
  with Repositories, [sync](../../repositories/sync/execution.md#time-source)), never `Date.now()` directly.
- **Single-flight:** concurrent calls for one integration share one in-flight mint (the sync runs
  3 sources in parallel, and the handle may use the same integration).
- **Least privilege, per operation:** the repository listings mint
  `{"permissions": {"metadata": "read"}}`; `getIssue` and `probeIssues` mint
  `{issues: read, metadata: read}`; `updateIssue` mints `{issues: write}`
  ([issues](issues.md#github-app-token-permissions)).
- **Eviction:** on a `401` from a call made with it, on integration delete, on replace credential.
  `evict(integrationId)` drops every permission set of that integration.
- **A mint across a Replace is not cached:** each entry records the `secret_iv` of the credential
  it was minted with; a mint that finishes after the stored `secret_iv` changed (a Replace or a
  key rotation in between) is used for its own call at most and never cached, so a token for the
  old credential is never reused after a Replace. The value stays inside the module, as for the
  [status compare-and-set](status-and-errors.md#status-compare-and-set).
- **Mint invalidation is a compare-and-set:** a mint `404` / `403` sets the integration `invalid`
  only if its credential is still the one used for the mint
  ([compare-and-set](status-and-errors.md#status-compare-and-set)).
- **401 retry:** a `401` with a *cached* token evicts it, mints once and retries the call
  **once**; a `401` with a **freshly minted** token (the retry, or a first call) answers
  `unavailable` (`unexpected`), logged with safe fields, status unchanged: the mint succeeded, so
  the installation exists. **Only a mint `404`/`403` invalidates a `github_app` integration**; a
  token revoked or rotated server-side never does.
- **Mint failures** (same mapping as the GitHub App test connection):

  | Mint answer | Integration | Result |
  |---|---|---|
  | `404` | `invalid` + `uninstalled` | `invalid_credentials` |
  | `403` | `invalid` + `suspended` | `invalid_credentials` |
  | `401` (app JWT rejected) | unchanged — server misconfiguration | `unavailable` (`unexpected`), logged at error level with safe fields |
  | `5xx`, timeout, rate limit | unchanged | `unavailable` / `rate_limited` |

- Repository calls do not mint per use (unlike the app JWT): see
  [GitHub App](../github-app/credentials.md#installation-token-cache). Test connection keeps minting fresh and
  dropping the token, so it checks the real state.

