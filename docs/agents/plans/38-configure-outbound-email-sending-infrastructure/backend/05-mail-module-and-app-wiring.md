# mail.module.ts + AppModule wiring

Create `backend/src/mail/mail.module.ts` and import it into `AppModule`.

## `mail.module.ts`

- `@Module({ imports: [ConfigModule], providers: [...], exports: [MailService] })`.
  (`ConfigModule` is already global via `ConfigModule.forRoot({ isGlobal: true })` in
  `app.module.ts`, so the explicit `imports` is optional — follow whatever `auth.module.ts` does;
  it does not re-import `ConfigModule`.)
- Define two injection tokens (module-level `const`s, exported):
  - `export const MAIL_CONFIG = 'MAIL_CONFIG'`
  - `export const MAIL_TRANSPORT = 'MAIL_TRANSPORT'`
- Providers:
  1. `{ provide: MAIL_CONFIG, inject: [ConfigService], useFactory: (cs: ConfigService) =>
     buildMailConfig(cs) }`
  2. `{ provide: MAIL_TRANSPORT, inject: [MAIL_CONFIG], useFactory: (config: MailConfig) => {
     if (!config.enabled) { new Logger('MailModule').log('outbound email disabled'); return
     null; } new Logger('MailModule').log(\`outbound email enabled (host=${config.transport.host})\`);
     return nodemailer.createTransport(config.transport); } }`
  3. `MailService`
- `mail.module.ts` is the **only** file that imports `nodemailer`. Keep it a thin
  `createTransport(...)` call — no logic beyond the enabled check and the boot log line. It falls
  under `jest.config.ts`'s wiring/coverage exclusion pattern the same way `app.module.ts` does;
  confirm `collectCoverageFrom` in `backend/jest.config.ts` still excludes it (it currently
  excludes `app.module.ts` and `main.ts` by name — add `!mail/mail.module.ts` if per-file
  coverage would otherwise flag it).
- The boot log line prints `enabled/disabled` + host only — never the whole config object.
- NodeNext imports: `./mail.service.js`, `./mail.config.js`.

## `AppModule` wiring

- `backend/src/app.module.ts` — add `MailModule` to the `imports` array (alongside `AuthModule`).
  Import path `./mail/mail.module.js`.

## Files to Change

- `backend/src/mail/mail.module.ts` — new
- `backend/src/app.module.ts` — add `MailModule` to `imports`
- `backend/jest.config.ts` — add `!mail/mail.module.ts` to `collectCoverageFrom` if needed
