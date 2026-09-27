# Add CORS config resolver and specs
Create `backend/src/core/cors-config.ts` exporting `buildCorsOptions(configService: ConfigService): CorsConfig | undefined`, where `CorsConfig` is `{ origin: string[] | true; credentials: true }`. Implement the resolution order and validation rules from [backend.md](../backend.md#context). Follow `mail.config.ts`'s style: small private helpers (`readTrimmed`, `parseAllowedOrigins`, `originFromFrontendBaseUrl`, `assertBareOrigin`), JSDoc on the exported function and its `@throws`, and no `process.env` reads.

Add Jest specs under `backend/src/core/tests/cors-config.spec.ts`, using a stubbed `ConfigService.get`, like `numeric-config.spec.ts`. Cover:
- A single origin and multiple comma-separated origins, with whitespace trimmed.
- An empty entry, a trailing comma, a path, a trailing slash, a query, a non-http(s) scheme, and garbage input. Each must throw, and the message must name the entry.
- `*` with `NODE_ENV=production` throws. `*` with `NODE_ENV=development` or unset returns `origin: true`. `*` mixed with other origins throws.
- `KERGHAN_ALLOWED_ORIGINS` unset with `FRONTEND_BASE_URL=https://app.example.com/some/path` returns `['https://app.example.com']`.
- An unparseable `FRONTEND_BASE_URL` throws.
- Both variables unset or blank returns `undefined`.
- `KERGHAN_ALLOWED_ORIGINS` takes precedence over `FRONTEND_BASE_URL`.
- `credentials` is always `true` when options are returned.

## Files to Change
- `backend/src/core/cors-config.ts` — new resolver/validator.
- `backend/src/core/tests/cors-config.spec.ts` — new specs.
