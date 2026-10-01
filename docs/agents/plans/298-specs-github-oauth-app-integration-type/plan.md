# Plan: Specs: GitHub OAuth App integration type

Issue: [298-specs-github-oauth-app-integration-type.md](../../issues/298-specs-github-oauth-app-integration-type.md)

## Overview

Write the `oauth_app` type spec at `docs/agents/specs/integrations/types/oauth-app.md`, covering
every item of the type contract's checklist, and make the small generic-spec updates the
redirect flow needs (a way for the frontend to know which types are enabled, a shared error code
for a bad `state`, and the new `state` table). Docs only; #302 implements it.

## Context

- The generic specs (#296) and the PAT spec (#297) live in `docs/agents/specs/integrations/`.
  `type-contract.md` fixes the redirect flow invariants: GitHub redirects to a frontend-served
  landing URL, the frontend `POST`s `{ code, state }` to a type-owned backend `.json` route,
  `state` is server-side, single-use and bound to the user.
- Tent today: `frontend.php` serves `/` and `/assets`, `backend.php` forwards every `*.json`
  (opt-out cache via `X-Skip-Cache`), `redirects.php` (last) turns `GET /path` into
  `302 /#/path`. `CacheControlMiddleware` only sets `max-age`; there's no generic header
  middleware yet.
- `FRONTEND_BASE_URL` already gives the public base URL per environment, so the OAuth callback
  URL can be derived from it instead of adding a third variable.
- The frontend uses hash routes (`HashRouteResolver.js`), so the landing path is a real path
  served by a dedicated Tent rule, not a hash route.

## Implementation Steps

### Step 1 — Write `types/oauth-app.md`

Following `types/pat.md`'s structure, define: overview, flow (redirect only; start route,
landing URL, callback route; create vs. replace credential; `state` table, TTL, single use,
constant-time compare, PKCE), required scope (`repo`, read from the token response and
`X-OAuth-Scopes`), token exchange and validate error mapping, secret payload, metadata,
`secretHint` (`gho_…<last 4>`), expiry (`null`, no refresh), test connection, `invalid` reason
codes, server config (client id/secret, both optional, one alone fails boot, callback URL from
`FRONTEND_BASE_URL`, disabled behaviour), Tent rules, delete (revoke only this token), error
cases, UI guidance, required tests and the manual smoke check for #302.

### Step 2 — Update the generic specs

- `README.md`: link `types/oauth-app.md`; mention the extra table in "Backward compatibility".
- `api.md`: add `POST /integrations/types.json` (enabled types, for the picker) and the
  `INTEGRATION_REDIRECT_STATE_INVALID` error code.
- `ui.md`: the type picker reads the enabled types from that route.
- `model.md`: list the `integrations_oauth_states` table owned by the module (defined in the
  type spec).
- `docs/agents/specs.md`: add the type specs to the Active specs row.

## Files to Change

- `docs/agents/specs/integrations/types/oauth-app.md` — new type spec.
- `docs/agents/specs/integrations/README.md` — index link, backward compatibility note.
- `docs/agents/specs/integrations/api.md` — types route, new error code.
- `docs/agents/specs/integrations/ui.md` — type picker source.
- `docs/agents/specs/integrations/model.md` — module tables.
- `docs/agents/specs.md` — Active specs files list.

## CI Checks

- Markdown lint over `docs/` (CI job: markdown lint), run through docker-compose.

## Notes

- GitHub behaviour (PKCE support, the 10-tokens-per-user/app/scope limit, one-year inactivity
  revocation, `DELETE /applications/{client_id}/token`) follows GitHub's docs; the spec asks
  #302 to check it again when implementing.
- No security review is needed for a docs-only change; #302's PR gets the `security`, `cache`
  and `proxy` reviews.
