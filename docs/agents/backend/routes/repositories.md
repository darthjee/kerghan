# Routes — Repositories

The HTTP surface of the Repositories module, in the style of
[Routes — Integrations](../../modules/integrations/github-service.md). Entity, sync and security rules live in the
[Repositories module](../../modules/repositories.md).

## Every route

- Routes end in `.json`; Tent forwards them to the backend.
- **Every route is `POST`**, reads included. User-scoped reads use `POST` like
  `POST /integrations/mine.json`: Tent's cache key ignores the method, so a user-scoped `GET`
  risks being cached for everyone ([caching.md](../../architecture/caching.md)). No repositories
  route answers `GET`.
- **Auth:** every route sits behind the global `JwtGuard` (no `@Public()`, no `@AdminOnly()`) and
  is scoped to the caller (`req.user.sub`).
- **CSRF:** every route is `POST`, so the global `OriginGuard` covers all four
  ([security](../../modules/repositories/security.md#csrf)).
- **Caching:** cache class **`user-scoped`** (`@CachePolicy(CacheClass.UserScoped)`,
  [caching.md](../../architecture/caching.md#cache-classes)). As for any non-`GET`, every response
  that passes the global guards (success and handler errors alike) sends `X-Skip-Cache: true`
  and `Cache-Control: no-store`. `JwtGuard` / `OriginGuard` rejections run before the interceptor
  and carry no cache headers, which is harmless since Tent caches only 2xx
  ([caching.md](../../architecture/caching.md#response-headers)). The Add rate limit runs in the
  service, after the interceptor, so its `429` carries the headers.
- **Navi:** no route is warmed; none belongs in `navi/navi_config.yaml`.
- **Errors** use the standard error format (`core/http-exception.filter.ts`); see
  [Errors](repositories/errors-and-access.md#errors).
- Controllers stay thin: validation in DTOs, everything else in the module's services.
- **Handle reconciliation first:** every route (listing, sync state, Refresh, Add) first runs the
  [handle reconciliation](../../modules/auth/github-handle.md#handle-changes), so a changed or cleared GitHub handle's old
  rows are dropped (and pruned) before anything is read or written. The sync-state route stays a
  pure read of the sync: it never starts one.
- **Bodies** go through the global `ValidationPipe({ whitelist: true, transform: true })`:
  unknown properties are **stripped and ignored**, not rejected. A body sent to a "no body" route
  (Sync state, Refresh) is ignored.

## Routes

| Action | Route | Body | Success |
|---|---|---|---|
| [Listing](repositories/listing.md#listing) | `POST /repositories/mine.json` | `{ page, perPage, filter, search }` | `200` `{ repositories, pagination, sync }` |
| [Sync state](repositories/identity-and-sync.md#sync-state) | `POST /repositories/sync/state.json` | none | `200` sync-state object |
| [Refresh](repositories/refresh-and-add.md#refresh) | `POST /repositories/sync.json` | none | `202` sync-state object |
| [Add](repositories/refresh-and-add.md#add) | `POST /repositories/add.json` | a [repo ref](repositories/identity-and-sync.md#repo-ref): `{ githubId }` or `{ fullName }` | `200` repository row |

## Pages

- [Listing](repositories/listing.md): read when changing `POST /repositories/mine.json` (request, response, stale-sync trigger).
- [Identity and sync state](repositories/identity-and-sync.md): read for the `githubId` identity, the repo ref, the sync-state object and the polling contract.
- [Refresh and Add](repositories/refresh-and-add.md): read when changing Refresh, Add or the Add rate limit.
- [Errors and access](repositories/errors-and-access.md): read for the error codes and the access rules.
- [Required tests](repositories/required-tests.md): read before writing or reviewing route tests.
