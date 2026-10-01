# Issue: Specs: Personal Access Token integration type

## Description
Part of #295 (GitHub integrations). Add the type spec for the **Personal Access Token** (`pat`) integration type as `docs/agents/specs/integrations/types/pat.md`, following the type contract defined by #296 (`docs/agents/specs/integrations/type-contract.md`, section *What a type spec must contain*). PAT is the first type implemented: #300 ships it together with the generic backend module, and #301 builds its create form.

This is a definition-only issue: no code changes.

## Problem
- The generic specs (#296) leave the credential payload, metadata, required permissions, `secretHint` format, `invalid` reason codes, expiry source and delete behaviour as opaque per-type slots. #300 can't implement the PAT strategy until they are fixed.
- GitHub has two PAT kinds with very different introspection: classic tokens (`ghp_`) expose their scopes in the `X-OAuth-Scopes` header; fine-grained tokens (`github_pat_`) don't expose their permissions at all. How "sufficient permissions" is checked has to be decided per kind.

## Expected Behavior
`types/pat.md` covers every item of the type contract's checklist, with these decisions:

### Supported tokens
- **Both kinds are accepted**, recognised by prefix: classic (`ghp_`) and fine-grained (`github_pat_`). Any other prefix fails validation (400 `VALIDATION_FAILED`, without echoing the value).
- The token kind is recorded in `metadata` (e.g. `tokenKind: "classic" | "fine_grained"`).
- The UI guidance recommends fine-grained tokens (least privilege).

### Permissions
- **Classic:** the `repo` scope is **required** (needed for private repositories, the main reason for #295). It is read from the `X-OAuth-Scopes` header. A token without `repo` is rejected with `INTEGRATION_INSUFFICIENT_PERMISSIONS` on create/replace, and becomes `invalid` + `insufficient_permissions` on test. The spec and UI warn that `repo` also grants write access, and point to fine-grained tokens as the narrower option.
- **Fine-grained:** GitHub doesn't expose their permissions, so **only the identity is validated** (`GET /user` must succeed). The metadata records permissions as unverified. The UI tells the user to grant *Issues: read* and *Metadata: read* on the repositories they want. A missing permission only shows up on later use, which is out of scope for #295 (the backend proxy).

### Flow, payloads and metadata
- **Flow kind:** credential-paste only (generic create and replace-credential routes). No type-owned routes, env vars or app credentials.
- **`credential` request shape** and **secret payload shape** (the plaintext that gets encrypted), with validation rules (prefix, length, charset) that never echo the value. Unknown credential fields are rejected.
- **Metadata shape** and its validation: token kind, scopes (classic only; `null`/unverified for fine-grained), and nothing usable as a credential.
- **Validate / create:** the GitHub call used (`GET /user` through the shared, injectable GitHub client), what is captured (login, kind, scopes, expiry), and how the permission check above is applied.

### Expiry, test and status
- **Expiry:** `expiresAt` comes from GitHub's `github-authentication-token-expiration` response header, refreshed on every successful test. It is `null` when the token has no expiry.
- **Test connection:** maps GitHub's answer to `active`, `invalid` + reason, `expired` or a transient error. GitHub answers 401 to both expired and revoked tokens, so a 401 with a known past `expiresAt` is `expired`, and any other 401 is `invalid` + a reason code.
- **`invalid` reason codes** and their UI text (e.g. `bad_credentials` for a revoked or deleted token, plus the generic `insufficient_permissions`).

### Hint, delete and errors
- **`secretHint` format:** the known prefix plus the last 4 characters, e.g. `ghp_…a1b2` and `github_pat_…a1b2`.
- **Behaviour on delete:** **nothing on GitHub**. Kerghan only forgets the token. The UI reminds the user to revoke it on GitHub if they no longer need it.
- **Error cases** mapped to the generic error codes in `api.md` (`VALIDATION_FAILED`, `INTEGRATION_CREDENTIAL_INVALID`, `INTEGRATION_INSUFFICIENT_PERMISSIONS`, `GITHUB_UNAVAILABLE`, `GITHUB_RATE_LIMITED`).
- A **Required tests** section and the **manual smoke check** for #300.

### Verification
- `docs/agents/specs/integrations/types/pat.md` exists, and the `types/pat.md` entry in `docs/agents/specs/integrations/README.md` becomes a link to it.
- It passes the markdown lint.
