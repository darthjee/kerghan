# Issue: Specs: GitHub App installation integration type

## Description
Part of #295 (GitHub integrations). Add `docs/agents/specs/integrations/types/github-app.md`, the type spec for the **GitHub App installation** (`github_app`) integration type. It follows the [type contract](../specs/integrations/type-contract.md#what-a-type-spec-must-contain) and its redirect flow invariants, like the already-merged `types/pat.md` (#297) and `types/oauth-app.md` (#298). #303 implements it.

## Problem
The generic integrations spec (#296) leaves every per-type slot open for `github_app`: flow, routes, secret payload, metadata, permissions, status reasons, server config, proxy rule and delete behaviour.

A GitHub App installation also has a problem the other types don't. The `installation_id` that GitHub's redirect carries proves nothing. A `state` only proves the caller started a flow, not that they own the installation. An app-authenticated (JWT) `GET /app/installations/{id}` sees **every** installation of the app. So with `state` alone, any user could start a flow, skip GitHub, and post another account's (guessable, sequential) `installation_id`, claiming that account's private repositories.

## Expected Behavior
The type spec defines, at the same level of detail as `types/oauth-app.md`:
- **Flow:** start, frontend landing URL, backend callback, `state` row, and ownership verification (see Solution).
- **Installation access tokens:** short-lived and minted on demand from the app's private key; never stored.
- **Stored data:** secret payload, metadata, `githubLogin`, `expiresAt`, `secretHint`.
- **Required permissions** and how they are checked.
- **Server config:** env vars, boot rules, disabled behaviour, and the callback URL per environment (dev, CI, production).
- **Test connection**, and how an uninstalled or suspended installation shows up as status (`invalid` reason codes and UI text) without webhooks, per `product.md`.
- **Behaviour on delete**, access rules, error cases.
- **Proxy (Tent):** landing-page rule and cache rules for the callback; backend routes.
- **UI guidance**, **Required tests** and a **manual smoke check** for #303.

## Verification
- `docs/agents/specs/integrations/types/github-app.md` exists and is linked from the integrations `README.md` (replacing the plain-text placeholder).
- Generic specs that mention #299 (e.g. the `model.md` tables list and edge cases, the `README.md` backward-compatibility and optional config) are updated wherever this type adds tables or config.
- It passes the markdown lint.

## Solution
Decisions already taken:
- **Ownership verification:** the GitHub App enables *Request user authorization (OAuth) during installation*. The callback receives a `code` with the `installation_id` and `state`. The backend then:
  1. consumes the `state` (single-use, bound to `req.user.sub`, as in the OAuth App spec);
  2. exchanges the `code` for a user-to-server token using the app's client id and secret;
  3. calls `GET /user/installations` with that token, and accepts the `installation_id` only if it is listed;
  4. **discards** the user token (best-effort revoke). It is never stored.

  The same authorize-only flow also lets a user connect an **existing** installation they can access, without installing again (e.g. an org member whose admin already installed the app). The spec covers `setup_action` values, including `request` (an install pending org-owner approval, so no installation yet).
- **Secret payload:** `{ "installationId": <number> }`, encrypted like any other secret. The generic schema is unchanged, and the AAD binds the installation id to its row. Installation access tokens are minted on demand from the server's private key and never stored. `expiresAt` is `null`.
- **No per-user stored secret:** neither the minted installation token, nor the user-to-server and refresh tokens, nor a user-supplied app key.
- **Permissions:** request and require **Issues: read** and **Metadata: read** only. Missing permissions map to `INTEGRATION_INSUFFICIENT_PERMISSIONS` / `invalid` + `insufficient_permissions`.
- **Delete:** does **nothing on GitHub**, because other Kerghan users or integrations may share the installation. Only the row is deleted, and the Remove confirmation tells the user to uninstall on GitHub if they want to.
- **Status without webhooks:** test connection checks the installation through app-JWT calls. An uninstalled installation (404) and a suspended one (`suspended_at` set, or 403 on token mint) become `invalid` + `uninstalled` / `suspended`. Lost permissions become `insufficient_permissions`.
- **Server config** (all-or-none; none set disables the type, as for `oauth_app`): app id, app slug, private key (PEM, base64-encoded in one env var), client id and client secret. The callback URL is derived from `FRONTEND_BASE_URL`'s origin plus `/integrations/github_app/callback`, and each environment registers its own GitHub App.
- **Same installation, several integrations or users:** allowed and isolated, per `model.md`. Nothing reveals that another user holds the same installation.
