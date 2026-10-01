# Issue: Specs: GitHub OAuth App integration type

## Description
Part of #295 (GitHub integrations). Add the spec for the **GitHub OAuth App** (`oauth_app`) integration type as `docs/agents/specs/integrations/types/oauth-app.md`. It follows the [type contract](../specs/integrations/type-contract.md#what-a-type-spec-must-contain) and its **redirect flow invariants**, and fills every per-type slot the generic specs (#296) leave open, the same way `types/pat.md` (#297) does for PATs. The spec only defines; #302 implements it.

## Expected Behavior
`types/oauth-app.md` covers every item the type contract requires (payload, metadata, scopes, `secretHint`, `invalid` reason codes, flow, expiry, delete, access, required tests, manual smoke check for #302), with these decisions:

### Flow
- **Redirect-based only** (`flows: { credentialPaste: false, redirect: true }`). Generic create/replace answer 400 `INTEGRATION_FLOW_UNSUPPORTED`.
- The spec defines the start route (returns the GitHub authorize URL), the frontend-served landing URL GitHub redirects to, and the backend `.json` route the frontend `POST`s `{ code, state }` to — all under `/integrations/oauth_app/…`, `JwtGuard`, cache class `never`.
- **Create:** the user enters the label before the redirect; it is stored with the `state`. **Replace credential:** re-runs the same flow for an existing row; the `state` records the target row's uuid, and the owner check happens again on callback.
- **`state`:** random, single-use, short-lived (spec fixes the TTL), stored **server-side in a database table** (so it works across instances), bound to the initiating user, compared in constant time. The owner always comes from `req.user.sub`.
- The callback's credential check counts toward the create/replace failure cool-off.

### Scopes
- Request and require **`repo` only** (same rationale as classic PATs: private repositories). Granted scopes are read from GitHub's token response / `X-OAuth-Scopes`; missing `repo` → `INTEGRATION_INSUFFICIENT_PERMISSIONS` on callback, `invalid` + `insufficient_permissions` on test. Spec and UI warn that `repo` also grants write access.

### Tokens and expiry
- OAuth App user tokens don't expire, so there is **no refresh token and no refresh strategy**; `expiresAt` is `null`. A token GitHub revoked (user revoked the app, token unused for a year, token limit exceeded) shows up as a 401 → `invalid` with a type-defined reason code. The spec double-checks this against GitHub's docs.

### Server config
- Client ID/secret env vars (names fixed by the spec), read once at boot, and the callback URL per environment (dev, CI, production), documented in `docs/agents/environment-variables.md` by #302.
- **Both vars optional:** when unset, the `oauth_app` type is **disabled** — hidden in the type picker and its routes rejected. Setting only one of the two fails boot.

### Proxy (Tent)
- A **dedicated Tent rule** serves the frontend directly for the callback landing path (no hop through the `GET /path → /#/path` catch-all), with no caching. The spec defines the rule(s) needed for the start/callback backend routes too, and that the landing page sends `Referrer-Policy: no-referrer` (or `same-origin`).

### Delete
- Best-effort revocation of **only this integration's token** (`DELETE /applications/{client_id}/token`, authenticated with the app's client credentials). Other `oauth_app` integrations of the same GitHub user keep working. Failures never block deletion; `undecryptable` rows are deleted without cleanup.

## Verification
- `docs/agents/specs/integrations/types/oauth-app.md` exists and is linked from the integrations `README.md`.
- It passes the markdown lint.
