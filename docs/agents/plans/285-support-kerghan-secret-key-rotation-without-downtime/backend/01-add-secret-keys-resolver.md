# Add the secret-keys resolver
Create one place that turns the two env vars into a key set. It follows the pattern of
`core/cors-config.ts`'s `buildCorsOptions`: a pure function over `ConfigService`, exported
standalone so it can be unit-tested without booting `AppModule`.

- `core/secret-keys.ts` exports:
  - `interface SecretKeys { current: string; previous: string[]; all: string[] }`, where
    `all = [current, ...previous]`.
  - `buildSecretKeys(configService: ConfigService): SecretKeys`.
- `current` is `KERGHAN_SECRET_KEY` as read today (`configService.get<string>(...)`, `''` when
  unset, so `CacheTokenService`'s current fallback is preserved).
- `previous` is `KERGHAN_PREVIOUS_SECRET_KEYS` split on `,`, then trimmed and filtered:
  - blank entries dropped
  - entries equal to `current` dropped
  - duplicates dropped, keeping first-occurrence order
- Env var names are module-level constants with a one-line comment, matching
  `cors-config.ts`.
- Full JSDoc on the exported function and interface (project ESLint `jsdoc` rules).

Spec cases:
- unset previous var → `previous` is `[]`
- whitespace and blank entries are ignored
- the current key and duplicates are removed from `previous`
- `all` ordering is `[current, ...previous]`

## Files to Change
- `backend/src/core/secret-keys.ts`: new resolver
- `backend/src/core/tests/secret-keys.spec.ts`: new unit spec
