# Integrations: API contract

Part of the [integrations spec](README.md). Defines the generic HTTP surface shared by every
integration type. Entity rules live in [model.md](model.md); access, encryption and rate-limit
rules in [security.md](security.md).

## Conventions

- Routes end in `.json`; Tent forwards them to the backend.
- **User-scoped reads use POST**, like `POST /auth/authorization-requests/mine.json`. Tent's
  cache key ignores the method, so a user-scoped GET risks being cached for everyone (see
  [API Caching](../../architecture/caching.md)).
- **Caching:** every route is cache class `never` (`@CachePolicy(CacheClass.Never)`, declared at
  controller level) and therefore sends `X-Skip-Cache` and `Cache-Control: no-store`.
- **Navi:** none of these routes is warmed; none belongs in `navi/navi_config.yaml`.
- **Auth:** every route sits behind the global `JwtGuard` (no `@Public()`, no `@AdminOnly()`) and
  is scoped to the caller (`req.user.sub`). A foreign, missing or malformed `:uuid` answers
  **404**, never 403.
- **CSRF:** every state-changing route (`POST`, `PATCH`, `DELETE`) is covered by the global
  `OriginGuard` (see [Security](../../architecture/security.md#csrf)); nothing extra is needed.
- **Errors** use the standard error format (#283, `core/http-exception.filter.ts`, see
  [Error responses](../../architecture/backend.md#error-responses)). Specific codes are
  constants in `ErrorCodes` (`core/error-codes.ts`).
- Integrations are exposed by **UUID** only: non-enumerable, and it doesn't leak counts.
- Controllers stay thin: validation in DTOs, everything else in the module's services.

## Routes

| Action | Route | Body | Success |
|---|---|---|---|
| List mine | `POST /integrations/mine.json` | none | `200` `{ "integrations": [Integration, …] }`, newest first |
| Show | `POST /integrations/:uuid/show.json` | none | `200` `Integration` |
| Enabled types | `POST /integrations/types.json` | none | `200` `{ "types": [{ "type": "pat", "flows": { "credentialPaste": true, "redirect": false } }, …] }` |
| Create (credential-paste types) | `POST /integrations.json` | `{ label, provider, type, credential: { … } }` | `201` `Integration` |
| Rename | `PATCH /integrations/:uuid.json` | `{ label }` | `200` `Integration` |
| Replace credential | `POST /integrations/:uuid/credential.json` | `{ credential: { … } }` | `200` `Integration` |
| Test connection | `POST /integrations/:uuid/test.json` | none | `200` `Integration` (with the test outcome) |
| Delete | `DELETE /integrations/:uuid.json` | none | `204 No Content` |

### Enabled types

`POST /integrations/types.json` lists the types this server can create, in registry order, each
with its strategy's `flows`. A type whose server config is missing (e.g. `oauth_app` without its
client id and secret, see [types/oauth-app.md](types/oauth-app.md#when-disabled)) is left out.
`pat` is always listed. It needs no row and makes no GitHub call. #300 builds it with the
generic module; the frontend's type picker reads it ([ui.md](ui.md#type-picker)).

### Create envelope

```json
{
  "label": "Work",
  "provider": "github",
  "type": "pat",
  "credential": { "…": "type-specific" }
}
```

- `label`: string, trimmed, 1–100 characters ([model.md](model.md#constraints)).
- `provider`: must be `github`.
- `type`: one of `pat`, `oauth_app`, `github_app`.
- `credential`: an object whose shape the type spec defines and the type validates
  ([type-contract.md](type-contract.md)). It is converted to a `Secret` right after validation
  ([security.md](security.md#secrets-never-logged)).
- Unknown top-level fields are stripped by the global `ValidationPipe` (`whitelist: true`, as
  for every route). The type's own validation of `credential` rejects unknown credential fields,
  so nothing unexpected is ever encrypted.

**Redirect-based types** (OAuth App, GitHub App) don't start from a pasted credential. They own
their start/callback routes under `/integrations/<type>/…`, defined in their type spec
(#298, #299). Calling create or replace credential with a type that is not credential-paste answers
**400** `INTEGRATION_FLOW_UNSUPPORTED`. Rename, test, delete, list and show stay generic for every
type.

### Integration response

```json
{
  "id": "<uuid>",
  "provider": "github",
  "type": "pat",
  "label": "Work",
  "status": "active",
  "statusReason": null,
  "secretHint": "ghp_…a1b2",
  "githubLogin": "octocat",
  "metadata": { "…": "type-specific, non-secret" },
  "expiresAt": null,
  "lastTestedAt": "2026-10-01T12:00:00.000Z",
  "lastTestResult": "success",
  "createdAt": "2026-10-01T12:00:00.000Z",
  "updatedAt": "2026-10-01T12:00:00.000Z"
}
```

- `id` is the `uuid` column; the internal `id` and `user_id` are never returned.
- **Never returned:** the credential, the decrypted secret payload, `secret_iv`,
  `secret_auth_tag`, `secret_ciphertext` and `secret_key_id`. The response is built from an
  explicit allowlist of fields, never by serializing the entity.
- `secretHint` is the stored `secret_hint` column, computed once by the type's mask function at
  create and replace ([type-contract.md](type-contract.md#mask-the-secret)); it is never enough to
  reconstruct the secret. It is `null` when the status is `undecryptable`.
- `status` and `expiresAt` reflect the computed-on-read expiry rule
  ([model.md](model.md#expiry)).
- Dates are ISO-8601 strings, or `null`.

## Per-action behaviour

- **Owner lookup first.** On every `:uuid` route, the owner-scoped lookup (`uuid` + `user_id`)
  runs first, right after auth and CSRF. A miss answers 404 before any row-dependent check: flow
  kind, type-specific credential validation, the failure cool-off, the test cooldown, or any
  GitHub call. A foreign `:uuid` is therefore indistinguishable from a missing one.
- **List mine** returns every integration of the caller, whatever its status (including
  `undecryptable`). It never decrypts secrets: `secretHint` is read from the stored
  `secret_hint` column. A row whose `secret_key_id` doesn't match the configured key id is
  reported as `undecryptable` (compared without decrypting).
- **Show** returns one integration of the caller, with the same no-decryption rules as list.
- **Create:** checks, in order: payload validation → failure cool-off
  ([security.md](security.md#create-and-replace-credential-failure-cool-off)) → per-user cap →
  label uniqueness → GitHub validation through the type. Nothing is stored on any failure.
- **Rename** changes only `label`; status and every other field stay unchanged.
- **Replace credential:** checks, in order: owner lookup → flow kind and payload validation for
  the row's type → failure cool-off → GitHub validation through the type. On failure the
  previous credential, metadata and status stay unchanged.
- **Test connection:** checks, in order: owner lookup → per-integration cooldown
  ([security.md](security.md#test-connection-cooldown)), then calls GitHub through the type and
  records `last_tested_at` / `last_test_result`. A GitHub rejection is a **successful** test: it
  answers `200` with the new status (`invalid` or `expired`). A transient failure leaves the
  status unchanged, records the attempt, and answers with the upstream error below. A row that
  still can't be decrypted (unknown key id or auth-tag failure) answers `200` with status
  `undecryptable`, without calling GitHub; a stored `undecryptable` row whose key id matches the
  configured key is decrypted again and tested normally ([model.md](model.md#transitions)).
- **Delete** removes the row after the type's best-effort delete behaviour
  ([type-contract.md](type-contract.md#behaviour-on-delete)), which never blocks the deletion.

## Error codes

| Situation | Status | `error.code` | Routes |
|---|---|---|---|
| Not authenticated | 401 | `UNAUTHORIZED` | all |
| Cross-site state-changing request | 403 | `FORBIDDEN` (`OriginGuard`) | `POST`, `PATCH`, `DELETE` |
| Unknown, foreign or malformed `:uuid` | 404 | `NOT_FOUND` | all with `:uuid` |
| Payload validation failed (shape, label length, unknown `provider`/`type`, credential shape) | 400 | `VALIDATION_FAILED` | create, rename, replace |
| Type is not credential-paste | 400 | `INTEGRATION_FLOW_UNSUPPORTED` | create, replace |
| Redirect `state` unknown, expired, already used or not the caller's | 400 | `INTEGRATION_REDIRECT_STATE_INVALID` | type-owned redirect callbacks ([types/oauth-app.md](types/oauth-app.md#state)) |
| Duplicate label (case-insensitive) | 409 | `INTEGRATION_LABEL_TAKEN` | create, rename |
| Per-user cap reached | 409 | `INTEGRATIONS_LIMIT_REACHED` | create |
| GitHub rejected the credential | 422 | `INTEGRATION_CREDENTIAL_INVALID` | create, replace |
| Missing required scopes/permissions | 422 | `INTEGRATION_INSUFFICIENT_PERMISSIONS` | create, replace |
| Failure cool-off active | 423 | `INTEGRATION_CREDENTIAL_LOCKED` | create, replace |
| Test cooldown active | 429 | `INTEGRATION_TEST_COOLDOWN` (+ `Retry-After`) | test |
| GitHub unreachable or answered 5xx | 502 | `GITHUB_UNAVAILABLE` | create, replace, test |
| GitHub rate limit hit | 503 | `GITHUB_RATE_LIMITED` (+ `Retry-After` when GitHub gives a reset time) | create, replace, test |

Notes for #300:

- Every new specific code above is added to `ErrorCodes`.
- `422` is not yet in `CATEGORY_CODES`; #300 adds a `422 → UNPROCESSABLE_ENTITY` category code
  so a bare 422 is never rendered as `HTTP_422`.
- `Retry-After` (seconds, integer) is not emitted anywhere in the backend yet; #300 introduces
  it for the test cooldown.
- Messages never echo the submitted credential, never mention other users, and never include
  GitHub's raw response ([security.md](security.md#secrets-never-logged)).
- Per-type reason codes (e.g. `revoked`) appear in `statusReason`, not in `error.code`.

## Required tests

Backend e2e specs, split per concern like `auth.controller.skip-cache.e2e-spec.ts` and
`auth.controller.csrf.e2e-spec.ts`, with GitHub replaced by the fake GitHub client
([security.md](security.md#faking-github)):

- **Per action:** the success status and body, and every error row above that applies to it.
- **Response shape:** no response (list, show, create, rename, replace, test) contains the
  credential, the secret payload, `secret_*` fields, the internal `id` or `user_id`; `secretHint`
  is `null` for `undecryptable` rows.
- **Caching:** every route declares cache class `never` (the cache-policy coverage spec passes)
  and every response carries `X-Skip-Cache` and `Cache-Control: no-store`.
- **CSRF:** a cross-site `POST`/`PATCH`/`DELETE` answers 403, following #286's convention.
- **Create order:** cool-off, cap and duplicate-label rejections happen without any GitHub call.
- **Test outcomes:** rejection answers 200 with `invalid`/`expired`; transient failure answers
  502/503 and leaves the status unchanged; cooldown answers 429 with `Retry-After`.
- **Enabled types:** `pat` is always listed; a type whose server config is missing is not.
- **Expiry on read:** an `active` row past `expires_at` is returned as `expired` by list and show.
