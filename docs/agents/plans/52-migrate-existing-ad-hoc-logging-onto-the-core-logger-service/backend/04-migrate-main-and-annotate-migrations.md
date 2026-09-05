# Migrate `main.ts` and annotate the two migrations

## `main.ts`

- After `const configService = app.get(ConfigService)`, also resolve
  `const logger = app.get(LoggerService)` (import from `./core/logger.service.js`).
- Replace the boot line
  `` console.warn(`Kerghan backend listening on port ${port}`) `` (and its
  `// eslint-disable-next-line no-console`) with
  `logger.info('backend listening', { port })`.
- Leave the `bootstrap().catch((err: unknown) => { ... console.error(err); process.exit(1); })`
  handler as-is, keeping its `// eslint-disable-next-line no-console`, and add one line above it:
  `// Raw console: this runs when NestFactory.create may have thrown, so the DI container (and LoggerService) may not exist.`

## Migrations

Both files already carry a `// eslint-disable-next-line no-console` above their `console.warn`.
Extend that comment (or add a second line) noting why `LoggerService` is not used here, e.g.:
`// Raw console: migrations run via the TypeORM CLI, outside the Nest DI lifecycle — no LoggerService available.`

No code change to the `console.warn` calls themselves; levels, messages and conditions stay
identical.

## Files to Change

- `backend/src/main.ts` — resolve `LoggerService` from the app container; swap the boot
  `console.warn` for `logger.info('backend listening', { port })`; add an explanatory comment on
  the retained `console.error` in `bootstrap().catch(...)`.
- `backend/src/database/migrations/20260824120004-auth-seed-demo-user.ts` — add a one-line comment
  explaining the retained `console.warn`.
- `backend/src/database/migrations/20260903120007-auth-promote-demo-user-admin.ts` — add a one-line
  comment explaining the retained `console.warn`.
