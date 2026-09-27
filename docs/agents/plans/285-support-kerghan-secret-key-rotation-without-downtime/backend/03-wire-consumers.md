# Wire cookie-parser, JwtModule and the cache token to the resolver
Route every remaining consumer through `buildSecretKeys` so key resolution lives in one place.

- `app.module.ts`: `JwtModule.registerAsync`'s factory uses
  `secret: buildSecretKeys(configService).current`. The behaviour is unchanged, but the source
  is now the resolver. Update the `AppModule` JSDoc if it mentions the secret.
- `main.ts`: `app.use(cookieParser(buildSecretKeys(configService).all))`. `cookie-parser`
  accepts a string array natively (it signs with the first entry and unsigns by trying each).
  Update the bootstrap JSDoc, which lists `KERGHAN_SECRET_KEY`, to mention the previous-keys
  variable.
- `core/cache-token.service.ts`: `generate()` uses `buildSecretKeys(this.configService).current`
  and never the previous keys, because the token is a deterministic cache key, not a verified
  signature. Add a JSDoc sentence noting that rotation changes every user's cache token
  (cache misses only).
- Specs:
  - extend `core/tests/cache-token.service.spec.ts`: previous keys set → the token still
    equals the HMAC of the current key
  - extend `core/tests/app.module.spec.ts` if it covers the JwtModule options

## Files to Change
- `backend/src/app.module.ts`: JwtModule secret via the resolver
- `backend/src/main.ts`: cookie-parser gets the full key list; JSDoc update
- `backend/src/core/cache-token.service.ts`: current key via the resolver; JSDoc update
- `backend/src/core/tests/cache-token.service.spec.ts`: previous keys are ignored
