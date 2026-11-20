# Key Rotation

[Back to Environment Variables](../environment-variables.md)

## Rotating `KERGHAN_SECRET_KEY`

Keys must not contain commas, and must not have leading or trailing whitespace. Entries in
`KERGHAN_PREVIOUS_SECRET_KEYS` are trimmed, so a padded key would no longer match the value
that signed the old tokens.

**Routine rotation (zero downtime).** Use this only when the old key is *not* suspected to be
compromised:

1. Generate a new long random key.
2. Deploy with `KERGHAN_SECRET_KEY=<new>` and `KERGHAN_PREVIOUS_SECRET_KEYS=<old>`. New access
   tokens are signed with `<new>`; tokens already issued with `<old>` keep verifying.
3. Wait at least `KERGHAN_ACCESS_TOKEN_TTL_MS` (default 15 minutes), counted from the moment
   *every* backend instance runs the new config (instances still on the old config keep signing
   with `<old>`), so every access token signed with `<old>` has expired.
4. Deploy again with `<old>` removed from `KERGHAN_PREVIOUS_SECRET_KEYS`.

If Kerghan runs several backend instances behind a rolling deploy, old instances would reject tokens signed with `<new>` during the rollout. Use three
phases instead: (a) `KERGHAN_SECRET_KEY=<old>`, `KERGHAN_PREVIOUS_SECRET_KEYS=<new>`; (b)
`KERGHAN_SECRET_KEY=<new>`, `KERGHAN_PREVIOUS_SECRET_KEYS=<old>`; (c) remove `<old>`.

**Compromised key.** Do not list the leaked key in `KERGHAN_PREVIOUS_SECRET_KEYS`, because
anyone holding it could keep forging access tokens until it is removed. Deploy the new
`KERGHAN_SECRET_KEY` with the old key dropped entirely. Every outstanding access token is
rejected at once. Clients recover through the refresh flow, because refresh tokens do not
depend on the key.

Side effects (both variants):

- The cache token is always derived from the current key only, so it changes on the first
  deploy. That only causes cache misses.
- Refresh tokens are random values stored as SHA-256 hashes and do not depend on the key, so
  they are unaffected.

## Rotating `KERGHAN_INTEGRATIONS_KEY`

`KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` keeps retired keys **decrypt-only**: new and replaced
credentials are always encrypted with the current key, and each stored row's `secret_key_id`
picks the key that decrypts it (see `docs/agents/modules/integrations/security.md#encryption-at-rest`).
Keys must not contain commas, and must not have leading or trailing whitespace (entries are
trimmed).

Rows under a previous key move to the current key in two ways:

- **Lazily**, whenever a test connection decrypts one.
- **Explicitly**, with `yarn integrations:keys:reencrypt` (`make integrations-keys-reencrypt` in
  dev). It prints `reencrypted=<n> skipped_undecryptable=<n> skipped_changed=<n>` and exits `1`
  when any row couldn't be decrypted. It is idempotent, so it is safe to run again.

`yarn integrations:keys:status` (`make integrations-keys-status` in dev) is read-only. It prints
one `<keyId> <current|previous|unknown> <count>` line per key id, so you can tell when a retired
key no longer protects any row. Neither command ever prints a key, a ciphertext or a secret. In
production (Render), `dist/` is already built: run them from a shell on the backend service.

**Routine rotation.** Use this only when the old key is *not* suspected to be compromised:

1. Generate a new key with `openssl rand -base64 32`.
2. Deploy with `KERGHAN_INTEGRATIONS_KEY=<new>` and `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS=<old>`.
   Existing credentials keep working; new ones are encrypted with `<new>`.
3. Once *every* backend instance runs the new config, run `yarn integrations:keys:reencrypt`.
4. Run `yarn integrations:keys:status` and confirm the old key id shows `0`.
5. Deploy again with `<old>` removed from `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS`.

If Kerghan runs several backend instances behind a rolling deploy, an instance still on the old
config can't decrypt a row that a new instance already re-encrypted (lazily, on a test
connection) or encrypted with `<new>`. Use three phases instead: (a)
`KERGHAN_INTEGRATIONS_KEY=<old>`, `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS=<new>`, so every instance
can read `<new>` before any row uses it; (b) `KERGHAN_INTEGRATIONS_KEY=<new>`,
`KERGHAN_PREVIOUS_INTEGRATIONS_KEYS=<old>`, then reencrypt and check the status; (c) remove
`<old>`.

**Compromised key.**

1. Rotate right away, keeping the leaked key in `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` only long
   enough to re-encrypt, then run `yarn integrations:keys:reencrypt`.
2. Drop the leaked key as soon as `yarn integrations:keys:status` shows `0` for it.
3. Tell users to rotate their GitHub credentials (and replace them in Kerghan). Re-encrypting
   does not undo the exposure: anyone holding the leaked key and a copy of the old ciphertexts
   can still read them.

**Lost previous key.** Rows encrypted under a key that is no longer configured show as
`unknown` in `status` and are `undecryptable` until their owners replace the credential (or
delete the integration). `reencrypt` can't recover them.

**GitHub credentials — integrations only.** Issue fetching still reads public GitHub REST API
data unauthenticated (see `docs/agents/product.md`). User-supplied GitHub credentials are stored
only as integrations (`docs/agents/modules/integrations.md`), encrypted with
`KERGHAN_INTEGRATIONS_KEY`. There is no server-wide GitHub token variable to set; don't add one
without an explicit product decision. The OAuth App client id/secret above identify Kerghan's own
OAuth App (used to run the `oauth_app` integration flow), not a credential for reading GitHub.
Likewise, the GitHub App id, slug, private key, client id and client secret identify Kerghan's own
GitHub App (used to run the `github_app` install/connect flow and to mint installation tokens for
each user's own installation), not a server-wide credential for reading GitHub.

