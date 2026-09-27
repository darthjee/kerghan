# Wire the resolver into main.ts
In `bootstrap()`, after `ConfigService` is obtained and before `app.listen`, call `buildCorsOptions(configService)`. If it returns options, call `app.enableCors(options)` and log `logger.info('cors enabled', { origins })`, where origins is the list or `'reflect-any'` for the dev wildcard. If it returns `undefined`, don't enable CORS. Update the `bootstrap` JSDoc to mention the CORS allowlist. A validation error propagates to the existing `bootstrap().catch`, which exits with code 1 (fail fast).

## Files to Change
- `backend/src/main.ts` — apply the resolved CORS options and update the JSDoc.
