# Integrations (spec)

> **Temporary spec.** This folder is the source of truth for the sub-issues of #295 (GitHub
> integrations) while they are built. The last sub-issue (#304) folds the lasting parts into the
> permanent docs and deletes this folder. See the [specs hub](../../specs.md).

## What an integration is

An **integration** is a labelled GitHub credential slot owned by one Kerghan user. Kerghan's
**backend** (never the browser) will later use it to talk to GitHub on that user's behalf.

- `provider`: `github` (the only provider specified).
- `type`: `pat` (Personal Access Token), `oauth_app` (GitHub OAuth App) or `github_app`
  (GitHub App installation).
- A user can have many integrations, each with its own user-defined label.
- Users manage them from an **Integrations** page, reached from the "My account" dropdown.

## Why

- **Private repositories**: unauthenticated access only sees public data.
- **Per-credential rate limit**: an authenticated GitHub call is limited per credential, not by
  the unauthenticated 60 requests/hour per IP.
- **Groundwork for backend proxying**: a later feature can fetch issues through the backend with
  the user's credential. That proxy is **not** part of #295.

## Product decision

Issue #295 is the product decision that lifts the `CLAUDE.md` "no GitHub credential storage"
boundary, **for integrations only**, exactly as defined in this folder. Any other way of storing
GitHub credentials still needs its own product decision. Issue fetching stays unauthenticated
and frontend-side until a separate feature changes it.

## Scope

**In scope** (type-agnostic; defined in this folder):

- Purpose and the product decision above.
- The `Integration` entity: every generic field and constraint. The secret payload and the
  metadata are opaque slots whose shape each type defines.
- The fixed values of `provider` and `type`.
- The type contract: what every type must provide ([type-contract.md](type-contract.md)).
- The generic API: list, show, create envelope, rename, replace credential, delete and test
  connection, with access rules, error format and caching.
- Secrets: encryption with a single `KERGHAN_INTEGRATIONS_KEY`, a key id stored per ciphertext,
  and the rule that secrets never leave the backend.
- The UI shell: the page, list columns, generic actions, type picker and the *Integrations* menu
  item.
- Non-binding [future use](#future-use-non-binding) notes.

**Out of scope:**

- Per-type payloads, flows, callbacks, app credentials and env vars: #297 (PAT), #298 (OAuth
  App) and #299 (GitHub App).
- Rotation of `KERGHAN_INTEGRATIONS_KEY`: #305.
- Using integrations for issue fetching (the backend proxy), and linking repos to integrations.
- The full rewrite of `product.md`, `flow.md` and the module docs: #304.
- Providers other than GitHub. The `provider` field allows them, but none is specified.
- Any implementation. This folder only defines; #300–#303 implement.

## Backward compatibility

- **Existing behaviour is unchanged:**
  - Issue fetching stays unauthenticated and frontend-side.
  - Login, refresh and device authorization are untouched.
  - The "My account" dropdown only gains an *Integrations* item.
  - Navi warm-up is unaffected, since every new route is cache class `never`.
- **Database:** additive only (the `integrations` table, the
  `integrations_credential_lockouts` table, with #302 the `integrations_oauth_states` table, and
  with #303 the `integrations_github_app_states` table). There is no existing data to migrate.
  Each migration has a working `down`, so a rollback drops the new tables.
- **New required config:** `KERGHAN_INTEGRATIONS_KEY`.
  - Boot **fails** if it is missing or malformed (see [security.md](security.md#key)).
  - Every environment (dev, CI, production) must have it set **before** #300 is deployed.
  - #300 adds it to the docker-compose and `.env` samples and to CI, and documents the
    production step in `docs/agents/environment-variables.md`.
- **Optional config:** the OAuth App type's client id and secret
  ([types/oauth-app.md](types/oauth-app.md#server-config)), and the GitHub App type's app id,
  slug, private key, client id and client secret
  ([types/github-app.md](types/github-app.md#server-config)). When unset, that type is disabled
  and nothing else changes.
- **Readiness:** `/ready.json` (#288) gets no integrations check; boot validation already covers
  the key.
- **Agent rules:** the `CLAUDE.md` credential-storage boundary is reworded by #296 to allow
  integrations as defined here. #304 finalizes the wording.

## Future use (non-binding)

These notes record intent only. No field, route or behaviour is added for them now.

- A backend proxy may pick a user's "default" integration, or one integration per tracked repo,
  to fetch issues with.
- When the backend uses an integration and GitHub answers 401, that use may set the integration
  to `invalid` (see [model.md](model.md#status-lifecycle)).
- Admin support tooling (e.g. read-only metadata, or deleting a leaked credential) may come
  later, as its own issue with its own product decision. Today admins have **no** access (see
  [security.md](security.md#access-rules)).

## Which issue reads what

| Issue | Reads |
|---|---|
| #300 (backend) | [model.md](model.md), [api.md](api.md), [security.md](security.md), [type-contract.md](type-contract.md) |
| #301 (frontend) | [ui.md](ui.md), [api.md](api.md) |
| #302 (OAuth App), #303 (GitHub App) | [type-contract.md](type-contract.md) plus their type spec |
| #297–#299 (type specs) | [type-contract.md](type-contract.md), [model.md](model.md), [security.md](security.md) |

## Files

- [model.md](model.md): the `Integration` entity, constraints, status lifecycle, edge cases.
- [api.md](api.md): routes, payloads, response shape, error codes, caching.
- [security.md](security.md): access rules, encryption, key and key id, logging, rate limits.
- [ui.md](ui.md): the Integrations page, list columns, actions, type picker, menu item.
- [type-contract.md](type-contract.md): what every integration type must provide.
- `types/`: per-type specs, added by their own issues (not by #296):
  - [types/pat.md](types/pat.md): #297
  - [types/oauth-app.md](types/oauth-app.md): #298
  - [types/github-app.md](types/github-app.md): #299
