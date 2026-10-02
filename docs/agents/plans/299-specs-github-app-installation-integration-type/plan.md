# Plan: Specs: GitHub App installation integration type

Issue: [299-specs-github-app-installation-integration-type.md](../../issues/299-specs-github-app-installation-integration-type.md)

## Overview

Write `docs/agents/specs/integrations/types/github-app.md`, the type spec for `github_app`. It
should match `types/oauth-app.md` (#298) in shape and level of detail. Then update the generic
integrations specs and the specs hub so they link to it and reflect what it adds: a state table,
optional server config and error codes. This is docs-only work owned by the architect; no
specialist agent has code changes.

## Context

- The generic spec (#296), PAT spec (#297) and OAuth App spec (#298) are merged under
  `docs/agents/specs/integrations/`. `type-contract.md#what-a-type-spec-must-contain` is the
  checklist, and `type-contract.md#redirect-flow-invariants` is binding.
- Decisions taken in the issue (binding on the spec):
  - **Ownership verification:** the app enables *Request user authorization (OAuth) during
    installation*. The callback gets `code`, `installation_id`, `setup_action` and `state`. The
    backend then:
    - consumes the `state`;
    - exchanges `code` for a user-to-server token with the app's client id and secret;
    - accepts the `installation_id` only if `GET /user/installations` (as that user) lists it;
    - revokes and discards the user token best-effort, and never stores it.
  - **Secret payload:** `{ "installationId": <number> }`, encrypted as usual. Installation access
    tokens are minted on demand from the app's private key (app JWT, then
    `POST /app/installations/{id}/access_tokens`) and never stored. `expiresAt` is `null`.
  - **Permissions:** Issues: read and Metadata: read, required and checked against the
    installation's `permissions`.
  - **Delete:** nothing on GitHub; only the row is deleted.
  - **Status without webhooks:** test connection uses app-JWT calls:
    - 404 on the installation → `invalid` + `uninstalled`;
    - `suspended_at` set, or 403 on token mint → `invalid` + `suspended`;
    - lost permissions → `insufficient_permissions`.
  - **Server config, all-or-none:** app id, app slug, private key (PEM, base64-encoded in one
    env var), client id and client secret. None set disables the type. The callback URL is the
    origin of `FRONTEND_BASE_URL` plus `/integrations/github_app/callback`, and each environment
    registers its own GitHub App.

## Implementation Steps

### Step 1 — Write `types/github-app.md`

Mirror the section order of `types/oauth-app.md`: Overview, Flow (Routes, Start, Landing,
Callback, State), Required permissions, Validate / create, Secret payload shape, Metadata shape,
Expiry, Test connection, `invalid` reason codes, `secretHint` format, Server config (+ When
disabled), Proxy (Tent), Behaviour on delete, Access, Error cases, UI guidance, Required tests,
Manual smoke check (#303). Points each section must settle:

- **Routes:**
  - `POST /integrations/github_app/start.json`: body `{ label }` or `{ integrationId }`, exactly
    one. It returns `{ "installUrl": "https://github.com/apps/<slug>/installations/new?state=…" }`.
  - Landing `GET /integrations/github_app/callback`, served by Tent as the SPA.
  - `POST /integrations/github_app/callback.json` with `{ code, installationId, setupAction, state }`.
  - Same guards, cache class `never` and check ordering as OAuth App start and callback: disabled
    → 404, validation, replace target lookup, cool-off 423, then cap and label 409 (create only).
- **`setup_action`:**
  - `install` and `update` carry an `installation_id`.
  - `request` (an org member asked an owner to approve) has none. The frontend shows "Waiting
    for an organization owner to approve the installation", makes no call, and the state expires.
  - Note that with user authorization during install, GitHub redirects to the *callback URL* and
    not the setup URL; the app's settings must reflect this, and #303 re-checks it against
    GitHub's docs.
- **Existing installation:** a user can connect an installation they can already access (e.g.
  org already installed). Opening the install URL for an account that already has the app lets
  an admin *configure* it, and redirects with `setup_action=update` and the `installation_id`.
  A non-admin member who can't configure it is out of scope for this type; the spec says so
  explicitly and records it as future work rather than adding a second selection step.
- **State:**
  - A new table `integrations_github_app_states`, owned by the Integrations module and created
    by #303's migration.
  - Same rules as `integrations_oauth_states`: format `<uuid>.<secret>`, `secret_hash`, bound to
    the user in the query, constant-time compare, atomic single-use `DELETE`, 10-minute TTL,
    at most 5 pending rows per user, never logged.
  - No `code_verifier` column, unless GitHub's installation flow is confirmed to forward PKCE
    parameters; state the assumption.
  - State the rejected alternative: generalizing `integrations_oauth_states` with a `type`
    column, which would reopen #298's merged spec.
- **Validate / create:** the call sequence and an error-mapping table, as in the OAuth App spec:
  - code exchange: `bad_verification_code` → 422 `INTEGRATION_CREDENTIAL_INVALID`, counted;
  - `GET /user/installations` (paginate; match `id`; also check `app_id` equals the configured
    app id):
    - not listed → 422 `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE` (new code, counted), with the
      same text whether the installation doesn't exist or belongs to someone else;
  - app-JWT `GET /app/installations/{id}`: permissions check → 422
    `INTEGRATION_INSUFFICIENT_PERMISSIONS`; `suspended_at` set → 422 with a suspended code (decide
    whether that's a new code or `INTEGRATION_CREDENTIAL_INVALID`);
  - mint an installation token to prove the private key works, then drop it;
  - rate limit → 503 and network errors or 5xx → 502, not counted;
  - user-token revocation afterwards, best-effort through
    `DELETE /applications/{client_id}/token`.
- **Identity:** `githubLogin` is the installation account's login (user or org), which is what
  the list column shows. Metadata:
  `{ installationId, appId, accountLogin, accountType: "User"|"Organization", repositorySelection: "all"|"selected", permissions: { issues, metadata }, installedBy }`,
  where `installedBy` is the verifying GitHub user's login. Define `describeMetadata` rules (exact
  keys, types, bounds), and state that metadata never holds a token, key, JWT, `state` or code.
- **Secret payload validation on decrypt:** a positive integer `installationId`; a mismatch is
  handled as `undecryptable`.
- **`secretHint`:** e.g. `installation …4567`, the last 4 digits of the installation id, at most
  64 characters. Note that the id isn't secret; the hint just follows the contract.
- **Expiry:** `expiresAt` is always `null`. Installation tokens last 1 hour, but they're
  transient and never stored.
- **Test connection table:**
  - app-JWT `GET /app/installations/{id}`: 200 OK → `active` (refresh metadata and login);
    `suspended_at` → `invalid` + `suspended`; 404 → `invalid` + `uninstalled`; missing permission
    → `insufficient_permissions`;
  - then mint a token: 403 → `suspended`; 404 → `uninstalled`;
  - rate limit or 5xx → transient.
  - Test needs the app config. When the type is disabled, test answers a transient
    `unavailable`, or define a dedicated outcome. Decide this and contrast it with OAuth App,
    where test keeps working while disabled.
- **Reason codes and UI text:**
  - `uninstalled`: "Kerghan's GitHub App is no longer installed on this account. Reinstall it
    and reconnect."
  - `suspended`: "This installation is suspended on GitHub. Unsuspend it in the account's
    GitHub settings."
  - `insufficient_permissions`: shared code, with GitHub App wording about accepting updated
    permissions.
- **Server config:**
  - `KERGHAN_GITHUB_APP_ID` (numeric), `KERGHAN_GITHUB_APP_SLUG`
    (`[a-z0-9-]`), `KERGHAN_GITHUB_APP_PRIVATE_KEY` (base64 of the PEM; decoded and parsed as an
    RSA private key at boot), `KERGHAN_GITHUB_APP_CLIENT_ID` and `KERGHAN_GITHUB_APP_CLIENT_SECRET`.
  - All five set → enabled; none set → disabled; partial or malformed → boot fails, naming the
    variable and never printing a value.
  - `FRONTEND_BASE_URL` rules match the OAuth App's (required when enabled; `https` in
    production).
  - Per-environment table (dev, CI, production), including the GitHub App settings to register:
    Callback URL, "Request user authorization (OAuth) during installation" on, webhooks
    **inactive**, permissions as above, "Any account" vs "Only on this account" install target.
  - App JWT: RS256, `iat` = now − 60s, `exp` ≤ now + 10 min, `iss` = client id or app id per
    GitHub's current docs, minted per use and never logged or stored.
- **Proxy (Tent):**
  - A dedicated landing rule for `/integrations/github_app/callback`, same as the OAuth App rule
    (precedence over `backend.php`/`redirects.php`, `index.html` in production and Vite in dev,
    `Cache-Control: no-store`, `Referrer-Policy: no-referrer`).
  - It may share the middleware #302 adds. No new rule for the `.json` routes.
- **Delete:** `onDelete` is a no-op on GitHub. The Remove confirmation says the app stays
  installed on GitHub and may be used by other connections; uninstall it on GitHub if wanted.
- **Access:** the type-contract checklist, plus "the installation is bound to the user only
  through the `state` row and the user-token check, never through `installation_id` alone".
  Same installation for other users: allowed and isolated, and no error reveals it.
- **Required tests:** canary rules covering the private key, app JWT, installation token, user
  token, client secret, code and `state`, plus every row of the mapping tables. Most
  importantly: a forged `installationId` that isn't in `/user/installations` is rejected, and an
  installation of a different `app_id` is rejected.
- **Manual smoke check:** a throwaway GitHub App in dev covering install, the `request`
  landing, an uninstall that tests as `uninstalled`, suspend and unsuspend, and the type
  disappearing when the config is unset.

### Step 2 — Update the generic specs and hub

- `integrations/README.md`:
  - link `types/github-app.md` in Files and the per-issue table;
  - add `integrations_github_app_states` to the Backward compatibility database list;
  - add the GitHub App env vars to Optional config.
- `integrations/model.md`:
  - list `integrations_github_app_states` under Module and tables;
  - point the edge case "claim-state check … defined in #299" to the new spec's anchor.
- `integrations/api.md`: add any new error codes (e.g.
  `INTEGRATION_INSTALLATION_NOT_ACCESSIBLE`) to the error-code table, and generalize the
  `INTEGRATION_REDIRECT_STATE_INVALID` row to reference both type specs.
- `integrations/type-contract.md`: replace "fixed in #298/#299" wording with links where the
  landing shapes now live.
- `integrations/ui.md`: GitHub App picker description and any GitHub App-specific notes,
  only if the generic text needs them, as #298 did.
- `docs/agents/specs.md`: add `types/github-app` to the integrations row.

## Files to Change

- `docs/agents/specs/integrations/types/github-app.md`: new type spec.
- `docs/agents/specs/integrations/README.md`: links, tables, optional config.
- `docs/agents/specs/integrations/model.md`: new table and edge-case link.
- `docs/agents/specs/integrations/api.md`: new error codes and state-error row.
- `docs/agents/specs/integrations/type-contract.md`: links replacing "#298/#299" wording.
- `docs/agents/specs/integrations/ui.md`: only if needed for picker text.
- `docs/agents/specs.md`: hub row.

## CI Checks

- Markdown is linted by Codacy (markdownlint, see `.codacy.yml`). Keep lines at about 100
  characters and tables well-formed, as in the existing spec files. No code CI jobs apply.

## Notes

- GitHub specifics (redirect target with user auth during install, `setup_action` values, JWT
  `iss`, PKCE support in the install flow, token-mint error statuses) must be stated as "per
  GitHub's docs; #303 re-checks them", as the OAuth App spec does.
- Don't change `types/oauth-app.md` semantics; a separate state table avoids reopening #298.
- Connecting an existing installation as a non-admin org member is explicitly out of scope,
  recorded as future work.
- Out of scope: webhooks (`product.md`), storing user-to-server or installation tokens,
  uninstalling on delete, and any implementation (#303).
