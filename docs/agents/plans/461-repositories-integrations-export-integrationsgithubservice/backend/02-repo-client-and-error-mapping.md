# Repo client: endpoints, error mapping, redirect option

## `send` redirect option

`send(url, init, maxBodyBytes?, options?)` gains a `redirect?: 'error' | 'manual'` option, defaulting to `'error'`. The existing callers keep mapping a `3xx` to `network_error`. Only the new repo operations pass `'manual'`, so a `3xx` comes back as a response to classify, and no mode ever follows a redirect.

## Result types (`integrations.md#exported-service`)

Add `integrations/github-repo-results.ts`, which defines:
- `GithubRepo`, `RateLimitFields` (reusing `GithubRateLimitFields`), `RepoPageResult` and `RepoResult`;
- `IntegrationRef` (`{ id, uuid, label, type }`);
- `IntegrationUnusableReason`.

These types are part of the export surface.

## Repo HTTP client

Add `integrations/github-repo-client.service.ts`, an internal provider that is not exported. Every call targets `https://api.github.com`. The URLs are built only from fixed paths plus `?per_page=100&page=N`. A `Link` header is read only to know whether `rel="next"` exists (`hasNext`), and its URL is never used. A passed `etag` is sent as `If-None-Match`. Without a token, no `Authorization` header is sent.

| Method | Endpoint |
|---|---|
| `listUserRepos(token, page, etag?)` | `/user/repos?affiliation=owner,collaborator,organization_member&visibility=all&sort=created&direction=asc` |
| `listInstallationRepos(token, page, etag?)` | `/installation/repositories`, reading body `{ repositories }` |
| `listHandleRepos(token \| null, handle, page, etag?)` | `/users/{encodeURIComponent(handle)}/repos?type=owner&sort=created&direction=asc` |
| `getRepositoryById(token \| null, githubId)` | `/repositories/{githubId}` |
| `mintInstallationToken(jwt, installationId)` | `POST /app/installations/{id}/access_tokens`, body `{"permissions":{"metadata":"read"}}` |

`mintInstallationToken` parses `token` into a `Secret`, together with `expires_at`. A missing or malformed token means `unexpected`. The token is never logged or returned to anyone outside the module.

**Body caps:** listings read up to 2 MiB, and `getRepositoryById` up to 64 KiB. Over the cap, the call answers `unavailable` (`unexpected`).

**Entry validation:**
- `id` must be a positive integer below 2⁵³;
- `owner.login` must be at most 39 characters;
- `name` must be at most 100 characters;
- `private` must be a boolean.

Malformed entries are dropped, and only these four fields are kept.

## Error mapping (`integrations.md#error-mapping`)

A single pure classifier, `classifyRepoResponse(operation, status, headers, authenticated, clock)`, implements the table:
- `304` → `not_modified` (listings);
- `401` (authenticated) → `invalid_credentials`. The status side effect happens in step 03.
- `401` without a credential → `unavailable` (`unexpected`);
- `403`/`429` with `X-RateLimit-Remaining: 0` or a `Retry-After` → `rate_limited`. `resetAt` comes from `X-RateLimit-Reset`, otherwise from `clock.now()` + `Retry-After`. Only headers are read, never the body.
- any other `403`:
  - listings → `unavailable` (`forbidden`);
  - `getRepository` → `not_found`;
- `404`:
  - `getRepository` and the handle listing → `not_found`;
  - other listings → `unavailable` (`unexpected`);
- `3xx` other than `304` → `unavailable` (`redirect`);
- `5xx` → `unavailable` (`server_error`);
- a `GithubClientError` → `unavailable` (`timeout` / `network_error`);
- any other `4xx`, or a malformed or oversized body → `unavailable` (`unexpected`).

## Files to Change

- `backend/src/integrations/github-client.service.ts`: adds the `redirect` option to `send`.
- `backend/src/integrations/github-http.ts`: adds a `hasNextLink(link)` helper, if it is not put elsewhere.
- `backend/src/integrations/github-repo-results.ts`: new; the exported result types.
- `backend/src/integrations/github-repo-client.service.ts`: new; the fixed operations, the mint and the classifier.
