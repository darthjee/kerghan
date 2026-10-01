# Integrations: type contract

Part of the [integrations spec](README.md). Defines the extension point every integration type
implements. The generic code (entity, API, encryption, rate limits) never branches on `type`; it
delegates to the type's strategy. Each type is then specified in its own file under `types/`
(#297 PAT, #298 OAuth App, #299 GitHub App).

## Strategy interface

Every type provides one strategy, looked up by `type` in a registry. A TypeScript-flavoured
sketch for #300 (names are indicative; the semantics are binding):

```ts
interface IntegrationTypeStrategy {
  readonly type: 'pat' | 'oauth_app' | 'github_app';
  readonly flows: { credentialPaste: boolean; redirect: boolean };

  // Credential-paste types only: validate the `credential` DTO and wrap it as early as possible.
  parseCredential(raw: unknown): Secret;

  // Validate against GitHub (through the shared GitHub client) and build what gets stored.
  validate(secret: Secret): Promise<ValidatedCredential>;

  // Map GitHub's answer for a stored secret to a test outcome.
  test(secret: Secret, current: IntegrationView): Promise<TestOutcome>;

  // Validate and normalize the non-secret metadata this type stores.
  describeMetadata(metadata: unknown): TypeMetadata;

  // Produce the `secretHint` shown to the owner.
  mask(secret: Secret): string;

  // Best-effort cleanup when the integration (or its owner) is deleted.
  onDelete(secret: Secret | null, current: IntegrationView): Promise<void>;
}

interface ValidatedCredential {
  secret: Secret;           // the plaintext payload to encrypt (type-defined JSON shape)
  githubLogin: string;
  expiresAt: Date | null;
  metadata: TypeMetadata;   // non-secret
}

type TestOutcome =
  | { kind: 'active'; githubLogin: string; expiresAt: Date | null; metadata: TypeMetadata }
  | { kind: 'invalid'; reason: string }
  | { kind: 'expired' }
  | { kind: 'transient'; error: 'unavailable' | 'rate_limited'; retryAfterSeconds?: number };
```

### Flow kind

- **Credential-paste:** the user pastes a credential. The type uses the generic create
  (`POST /integrations.json`) and replace-credential routes and implements `parseCredential`.
- **Redirect-based:** the credential comes from a GitHub redirect. The type owns its start and
  callback routes under `/integrations/<type>/…`, defined in its type spec, and those routes
  still end by calling `validate` and the generic storage/encryption code.
- A type may support **both**. Generic create/replace with a type lacking credential-paste
  answers 400 `INTEGRATION_FLOW_UNSUPPORTED` ([api.md](api.md#create-envelope)).
- Rename, test, delete, list and show are generic for every type.

### Validate / create

- Validate the credential's shape; validation messages never echo the value
  ([security.md](security.md#secrets-never-logged)).
- Call GitHub **only** through the shared, injectable GitHub client
  ([security.md](security.md#faking-github)).
- Check the required scopes/permissions. Missing ones reject with
  `INTEGRATION_INSUFFICIENT_PERMISSIONS`; the type spec defines what counts as sufficient.
- Reject a credential GitHub refuses with `INTEGRATION_CREDENTIAL_INVALID`.
- Map network errors, GitHub 5xx and GitHub rate limits to the transient errors
  (`GITHUB_UNAVAILABLE`, `GITHUB_RATE_LIMITED`), which don't count toward the failure cool-off.
- Return the secret payload, `githubLogin`, `expiresAt` and `metadata`. The generic code
  encrypts and stores them.

### Test connection

- Map GitHub's answer to `active`, `invalid` + reason (including `insufficient_permissions` if
  permissions were lost), `expired`, or a transient error that leaves the status unchanged
  ([model.md](model.md#transitions)).
- On `active`, return refreshed `githubLogin`, `expiresAt` and `metadata`.

### Describe metadata

- Define the JSON shape stored in `metadata` (e.g. scopes, installation id, app slug) and
  validate it. Metadata is **non-secret by definition**: it is returned to the owner as-is.

### Mask the secret

- Produce `secretHint`: enough for the owner to recognise the credential (e.g. a known prefix
  and the last 4 characters), never enough to reconstruct it. The type spec fixes the format.

### Behaviour on delete

- Best-effort cleanup on GitHub (e.g. revoking an OAuth token, or nothing for a PAT), run on
  integration delete and on owner deletion.
- It never blocks the deletion: failures are logged with safe fields only, and the row is
  deleted anyway. An `undecryptable` row is deleted without cleanup (`secret` is `null`).

## Status reason codes

- Each type defines its `invalid` reason codes (e.g. `revoked`, `uninstalled`, `suspended`,
  `bad_credentials`) and their UI text.
- The generic code `insufficient_permissions` is shared by every type.
- Codes are lower-case snake_case, at most 64 characters (`status_reason` column).

## Registration

- Strategies are registered by `type` in one registry owned by the Integrations module.
- An unknown `type` is rejected by validation (400 `VALIDATION_FAILED`) before any strategy is
  looked up.
- Adding a type needs no migration, unless it promotes a new generic column.
- Type-specific env vars or app credentials (e.g. an OAuth App's client secret) are defined in
  the type spec and read once at boot, like every other config.

## What a type spec must contain

Each `types/<type>.md` file covers:

- Credential payload shape (the plaintext encrypted in `secret_ciphertext`) and, for
  credential-paste types, the `credential` request shape.
- Metadata shape.
- Required scopes/permissions, and how they are checked.
- `secretHint` format.
- `invalid` reason codes and their UI text.
- Flow kind, with any routes, callbacks, env vars and app credentials.
- Expiry: whether `expiresAt` is known and how it is obtained.
- Behaviour on delete.
- A **Required tests** section and the **manual smoke check** for its implementation issue.

## Required tests

- Each type's strategy has unit specs against the fake GitHub client: validate success, invalid
  credential, insufficient permissions, transient errors; test outcomes; metadata validation;
  mask format; delete behaviour (including failure not blocking deletion).
- The registry resolves each registered type and rejects an unknown one.
- The generic code never branches on `type` outside the registry.
