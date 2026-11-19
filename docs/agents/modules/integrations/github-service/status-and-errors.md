# Integrations — GitHub service: Status and errors

Part of the [GitHub service](../github-service.md) of the [Integrations module](../../integrations.md).

## Invalid on 401

A `401` from GitHub on a request made through a `pat` or `oauth_app` integration sets that
integration's status to `invalid`, with the type's existing bad-credentials reason (the same as
its test connection), inside the Integrations module. A `github_app` call's `401` never
invalidates; only a mint `404`/`403` does
([installation tokens](api.md#github-app-installation-tokens)). Transient failures (network errors,
`5xx`, rate limits) never change the status, as for test connection today.

### Status compare-and-set

Every status change caused by a repo call is conditional on the credential that call used:

- a `pat` / `oauth_app` `401` ⇒ `invalid`;
- a `github_app` mint `404` / `403` ⇒ `invalid`;
- a decrypt failure ⇒ `undecryptable`.

```sql
UPDATE integrations SET status = …, status_reason = …
WHERE id = :id AND user_id = :userId AND secret_iv = :ivUsed
```

- `secret_iv` is fresh on every encryption, so a Replace, or a key rotation, between the call and
  the write makes the write a no-op: a freshly replaced credential is never marked `invalid` by a
  request made with the old one.
- No new column. A missed invalidation after a key rotation recurs on the next call.
- `:ivUsed` stays inside the Integrations module: it never reaches Repositories, a response or a
  log ([security](../../../architecture/security.md#github-credentials-stay-in-the-backend)).

## Usable integrations

**An integration is usable when its reported status is `active` and its type is enabled on this
server** (a `github_app` integration is unusable when the app's server config is missing).

| Reported status | Sync source | Handle / Add candidate |
|---|---|---|
| `active` | called | yes |
| `expired` | listed, **no call**, status `invalid_credentials` | no |
| `invalid` | listed, **no call**, status `invalid_credentials` | no |
| `undecryptable` | listed, **no call**, status `invalid_credentials` | no |
| any, type disabled | listed, **no call**, status `error` | no |

- **`expired`:** GitHub would answer `401`, and the 401 rule would overwrite the precise `expired`
  with `invalid` + `bad_credentials`.
- **`invalid`:** nothing polls and an `invalid` integration is never retried by a sync; it
  returns to `active` only through Test or Replace on the Integrations page. Retrying on every
  sync would waste a call per broken credential.
- **`undecryptable`:** cannot be called. An `active` row that fails to decrypt during a call is
  set `undecryptable` (existing transition) and answers `integration_unusable`.
- **Type disabled:** the server's configuration, not the user's credential, so `error`.
- A non-usable source is a *failed* source: its earlier rows and pages are kept
  ([partial failures](../../repositories/sync/write-path.md#partial-failures)), so its repos stay listed until the integration
  is fixed or deleted. **Accepted:** they hold only the user's own data, visible only to that
  user; the banner says to fix the integration, and deleting it purges its rows at once.
  Rejected: expiring them (for example after 30 days), since added repos would flip to
  Unavailable and a fixed token would re-import everything.
- A fixed integration (Test or Replace returns it to `active`) reads `pending` until its next
  sync ([routes](../../../backend/routes/repositories/identity-and-sync.md#sync-state)).
- `listUsableIntegrations` returns only usable ones, oldest first, filtered by `user_id` in the
  query. The sync builds its sources from **all** the user's integrations; the handle and Add use
  the usable list.
- `integration_unusable` carries a reason, `'status' | 'type_disabled' | 'missing'`, so the sync
  maps it to `invalid_credentials`, `error`, or, for `missing` (no integration row for that id and
  user, e.g. deleted mid-sync), stops that source with **no status**
  ([sync](../../repositories/sync.md#sources)); the reason never reaches a response.

## Error mapping

One table in the client, for every call:

| GitHub answer | Result | Integration |
|---|---|---|
| `200`, well-formed body | `ok` | — |
| `304` (listings) | `not_modified` | — |
| `401`, authenticated | `invalid_credentials` | set `invalid` + the type's existing bad-credentials reason, as a [compare-and-set](#status-compare-and-set) (`pat`, `oauth_app`; a `github_app` call `401` never invalidates — see [installation tokens](api.md#github-app-installation-tokens)) |
| `403` / `429` with `X-RateLimit-Remaining: 0` or a `Retry-After` | `rate_limited`, `resetAt` = now (`Clock`) + `Retry-After` when GitHub sent one (a secondary limit), else `X-RateLimit-Reset`, else `null` | unchanged |
| any other `403` | listings: `unavailable` (`forbidden`); `getRepository`: `not_found` (denied) | unchanged — the user re-checks with Test |
| `404` | `getRepository` and the handle listing: `not_found`; other listings: `unavailable` (`unexpected`) | unchanged |
| `3xx` other than `304` | `unavailable` (`redirect`) — the repo operations pass `redirect: 'manual'`, so it is classified, never followed | unchanged |
| `5xx` | `unavailable` (`server_error`) | unchanged |
| timeout / network failure | `unavailable` (`timeout` / `network_error`) | unchanged |
| other `4xx`, malformed or oversized body, a `401` without a credential | `unavailable` (`unexpected`) | unchanged |

- **Redirect option:** `GithubClientService#send` gains a `redirect` option defaulting to today's
  `'error'`; only the new repo operations pass `'manual'`, so the existing callers (`GET /user`,
  OAuth exchange/revoke, GitHub App calls) keep mapping a `3xx` to `network_error` unchanged.
  Neither mode follows a redirect.
- Rate limits are detected from **headers only**. No body is parsed for messages, echoed or
  logged; logs carry safe fields only (integration id, operation, HTTP status, result kind).
- The handle listing's `not_found` (an unknown, renamed, suspended or deleted handle) maps to the
  source status **`not_found`**, with no fallback to another credential
  ([sync](../../repositories/sync.md#handle-credential)).
- `unavailable` reasons never reach a response; the sync maps them to `error`, Add to
  `502 GITHUB_UNAVAILABLE`.

