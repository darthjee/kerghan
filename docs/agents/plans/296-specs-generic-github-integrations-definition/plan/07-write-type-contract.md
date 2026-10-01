# Write `integrations/type-contract.md`

Create `docs/agents/specs/integrations/type-contract.md`, the extension point every type spec
(#297–#299) implements:

- **Strategy interface** (described language-neutrally, with a TypeScript-flavoured sketch for
  #300) — what every type must provide:
  - **flow kind** — credential-paste, redirect-based, or both (decides whether the generic
    create/replace routes apply, or the type owns `/integrations/<type>/…` routes);
  - **validate/create** — validate the `credential` DTO, convert it to `Secret` as early as
    possible, call GitHub through the shared GitHub client, check required scopes/permissions
    (rejecting with `insufficient_permissions` otherwise), and return the secret plaintext
    payload, `github_login`, `expires_at` and `metadata`;
  - **test connection** — map GitHub's response to `active` / `invalid` + reason / `expired`, or
    a transient error that leaves status unchanged;
  - **describe metadata** — the non-secret `metadata` JSON shape and its validation;
  - **mask the secret** — produce `secretHint` (never enough to reconstruct the secret);
  - **behaviour on delete** — e.g. best-effort revocation on GitHub (also on user delete), or
    nothing.
- **Type-defined `status_reason` codes** and their UI text.
- **What a type spec file must contain** (template for `types/<type>.md`): credential payload
  shape, metadata shape, required scopes/permissions, hint format, reason codes, flow and any
  routes/env vars/app credentials, delete behaviour, Required tests, manual smoke check.
- **Registration** — types are looked up by `type` in a registry; adding a type needs no
  migration unless it promotes a new generic column.
- **Required tests** section — each type's strategy unit specs against the fake GitHub client;
  registry rejects unknown types.

## Files to Change

- `docs/agents/specs/integrations/type-contract.md` — new type extension-point spec.
