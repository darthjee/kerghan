# Plan: Specs: Personal Access Token integration type

Issue: [297-specs-personal-access-token-integration-type.md](../../issues/297-specs-personal-access-token-integration-type.md)

## Overview

Write `docs/agents/specs/integrations/types/pat.md`, the type spec for the `pat` integration type,
and link it from the integrations README. This is documentation only: no code changes. The spec
fills every per-type slot the generic specs (#296) leave open, using the decisions recorded in
the issue.

## Context

- The generic specs live in `docs/agents/specs/integrations/` (`README.md`, `model.md`,
  `api.md`, `security.md`, `ui.md`, `type-contract.md`). They are temporary: #304 folds them into
  the permanent docs.
- `type-contract.md` → *What a type spec must contain* is the checklist `pat.md` must cover.
  The section *Required tests* there also defines what each type's strategy specs must test.
- Decisions from the issue discussion:
  - Both kinds accepted, by prefix: classic `ghp_` and fine-grained `github_pat_`.
  - Classic: the `repo` scope is required, read from `X-OAuth-Scopes`; warn that it also
    grants write access.
  - Fine-grained: identity only (`GET /user`); permissions recorded as unverified; the UI
    asks for *Issues: read* and *Metadata: read*.
  - Expiry from the `github-authentication-token-expiration` response header; `null` if absent.
  - `secretHint`: prefix + `…` + last 4 characters (`ghp_…a1b2`, `github_pat_…a1b2`).
  - Delete: nothing on GitHub; the UI reminds the user to revoke the token themselves.
- Readers: #300 (backend strategy) and #301 (frontend create form/guidance).

## Implementation Steps

### Step 1 — Write `types/pat.md`

Create `docs/agents/specs/integrations/types/pat.md`, following the style of the sibling specs
(header line "Part of the [integrations spec](../README.md)…", short bullet sections, relative
links into `../type-contract.md`, `../api.md`, `../model.md`, `../security.md`, `../ui.md`).
Sections, in the order of the type contract's checklist:

1. **Overview**: PAT is credential-paste only; first type, implemented by #300 with the
   generic module.
2. **Supported tokens**: classic (`ghp_`) and fine-grained (`github_pat_`), recognised by prefix;
   any other prefix → 400 `VALIDATION_FAILED` with a message that never echoes the value.
3. **`credential` request shape**: `{ "token": "<string>" }`; rules: string, trimmed, prefix
   allow-list, length bound (cap it, e.g. ≤ 255), charset `[A-Za-z0-9_]`; unknown fields rejected.
4. **Secret payload shape**: the plaintext JSON encrypted in `secret_ciphertext`
   (e.g. `{ "token": "<string>" }`), wrapped in `Secret` right after DTO validation.
5. **Metadata shape**: `tokenKind` (`classic` | `fine_grained`), `scopes` (array of strings for
   classic; `null` for fine-grained), `permissionsVerified` (boolean: `true` for classic after the
   `repo` check, `false` for fine-grained). Validation rules; nothing usable as a credential.
6. **Required scopes/permissions and how they are checked**:
   - Classic: `GET /user`, parse `X-OAuth-Scopes`; `repo` required, otherwise
     `INTEGRATION_INSUFFICIENT_PERMISSIONS` on create/replace and `invalid` +
     `insufficient_permissions` on test. Note that `repo` grants write access.
   - Fine-grained: `GET /user` only; permissions unverified; the UI guidance (*Issues: read*,
     *Metadata: read* on the wanted repositories) and that a missing permission only shows up on
     later use (backend proxy, out of scope).
7. **Validate / create**: the single call (`GET /user` through the shared, injectable GitHub
   client), what is captured (`githubLogin` from `login`, kind, scopes, expiry), and the error
   mapping: GitHub 401 → `INTEGRATION_CREDENTIAL_INVALID`; network error / 5xx →
   `GITHUB_UNAVAILABLE`; rate limit (403/429 with rate-limit headers) → `GITHUB_RATE_LIMITED`
   (transient, not counted toward the cool-off).
8. **Expiry**: from `github-authentication-token-expiration` (parse to UTC); `null` when the
   header is absent; refreshed on every successful validate/test.
9. **Test connection**: `GET /user` again; 200 + sufficient → `active` with refreshed login,
   expiry and metadata; 200 but classic without `repo` → `invalid` + `insufficient_permissions`;
   401 with a stored `expiresAt` in the past → `expired`; any other 401 → `invalid` +
   `bad_credentials`; transient errors leave the status unchanged.
10. **`invalid` reason codes and UI text**: `bad_credentials` ("GitHub rejected this token. It
    may have been revoked or deleted. Replace it with a new token.") plus the generic
    `insufficient_permissions` text for PAT ("This classic token lacks the `repo` scope.").
11. **`secretHint` format**: prefix + `…` + last 4 characters; examples for both kinds; within the
    64-character limit.
12. **Flow kind, routes, env vars**: credential-paste only; generic create and replace-credential
    routes; no type-owned routes, no env vars, no app credentials. So the type-owned-route access
    item of the checklist is "none".
13. **Behaviour on delete**: nothing on GitHub (no revocation call); the UI reminds the user to
    revoke the token on GitHub if they no longer need it.
14. **UI guidance** (for #301): the create form fields (label, token), a link to GitHub's token
    settings, the recommendation to use fine-grained tokens, the `repo` write-access warning, and
    the delete reminder.
15. **Required tests**: the type contract's strategy specs specialised for PAT (prefix
    validation for both kinds, unknown prefix, scope parsing, missing `repo`, fine-grained
    unverified metadata, expiry header present/absent, 401 → expired vs `bad_credentials`,
    transient errors, mask format for both kinds, delete makes no GitHub call), each using the
    fake GitHub client and a canary token that must never appear in logs or responses.
16. **Manual smoke check** for #300: create with a real classic token with `repo` scope, a
    fine-grained token, and a classic token without `repo` (rejected); test; replace; delete.

### Step 2 — Link the spec from the integrations README

In `docs/agents/specs/integrations/README.md`, under **Files**, turn the `types/pat.md` entry into
a link (`[types/pat.md](types/pat.md): #297`). Leave the #298/#299 entries as plain text. Make
sure `type-contract.md` → `types/` mentions still read correctly; no change is expected there.

## Files to Change

- `docs/agents/specs/integrations/types/pat.md` — new PAT type spec.
- `docs/agents/specs/integrations/README.md` — link the new spec from **Files**.

## Notes

- Markdown lint runs through Codacy (`markdownlint` in `.codacy.yml`); match the line length and
  list style of the sibling spec files.
- No code, migration, env var or Navi change is part of this issue.
- GitHub's exact header names and status codes should be checked against GitHub's REST docs
  while writing (`X-OAuth-Scopes`, `github-authentication-token-expiration`, rate-limit
  headers on 403/429).
