# Module — Integrations

Labelled, encrypted GitHub credentials, each owned by one Kerghan user. Lives in
`backend/src/integrations/` (backend) and the *Integrations* account page (frontend).

## Overview

An **integration** is a labelled GitHub credential slot owned by one Kerghan user. Kerghan's
**backend** (never the browser) uses it to talk to GitHub on that user's behalf.

- `provider`: `github` (the only provider).
- `type`: `pat` (Personal Access Token), `oauth_app` (GitHub OAuth App) or `github_app`
  (GitHub App installation). See [Types](#types).
- A user can have many integrations, each with its own user-defined label.
- Users manage them from the **Integrations** page, reached from the "My account" dropdown.

**Why integrations exist:**

- **Private repositories**: unauthenticated access only sees public data.
- **Per-credential rate limit**: an authenticated GitHub call is limited per credential, not by
  the unauthenticated 60 requests/hour per IP.
- **Repository listing**: the [Repositories module](repositories.md) lists a user's repositories,
  private and organization ones included, through the user's integrations.
- **Groundwork for backend proxying**: a later feature can fetch issues through the backend with
  the user's credential. That proxy does not exist yet; issue fetching stays unauthenticated and
  frontend-side (see [product.md](../product.md)).

**Product decision:** issue #295 lifts the "no GitHub credential storage" boundary **for
integrations only**, exactly as defined in this page and its type pages. Any other way of
storing GitHub credentials still needs its own product decision (see `CLAUDE.md`).

**Secrets never reach the browser.** The API returns only non-secret fields (label, status,
GitHub login, metadata, a masked `secretHint`); the decrypted credential never leaves the
backend. See [Security](integrations/security.md).

**Module classification:** **always-on**, imported directly into `AppModule`, like Auth (see
[Modular Pattern](../architecture/modular-pattern.md#module-classification)). It validates
`KERGHAN_INTEGRATIONS_KEY` at boot, so a bad key fails startup, and `integrations.user_id` carries
the project's only physical cross-module FK ([Owner foreign key](integrations/data-model.md#owner-foreign-key)). The module
exports `IntegrationsGithubService` (the only way another module reaches GitHub with a user's
credential) and emits the awaited `integration.deleted` event, both described in
[GitHub service](integrations/github-service.md). The first consumer is the
[Repositories module](repositories.md).

**Routes:** see [Integrations routes](../backend/routes/integrations.md) for the full endpoint
reference. Every route requires `JwtGuard`, ends in `.json` and is cache class `never`
(`X-Skip-Cache`), so Navi's warm-up never touches it.

**Not built yet (non-binding intent):**

- A backend proxy may pick a user's "default" integration, or one integration per tracked repo,
  to fetch issues with.
- Admin support tooling (read-only metadata, deleting a leaked credential) may come later, as its
  own issue with its own product decision. Today admins have **no** access
  ([Access rules](integrations/security.md#access-rules)).

## Pages

| Page | Read when |
|---|---|
| [Data model](integrations/data-model.md) | You need the table, columns, constraints, status lifecycle, expiry or edge cases. |
| [Security](integrations/security.md) | You touch access rules, encryption, key handling, logging, rate limits or test doubles. |
| [Type contract](integrations/type-contract.md) | You add or change an integration type, or its strategy interface. |
| [Frontend](integrations/frontend.md) | You work on the Integrations page, its list, actions or type picker. |
| [GitHub service](integrations/github-service.md) | Another module calls GitHub with a user's credential. |

## Types

- [Personal Access Token (`pat`)](integrations/pat.md): credential-paste.
- [GitHub OAuth App (`oauth_app`)](integrations/oauth-app.md): redirect-based.
- [GitHub App installation (`github_app`)](integrations/github-app.md): redirect-based.
