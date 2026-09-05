# Register a global logging module

`core/cache-token.service.ts` is registered directly in `AppModule.providers`, but that pattern
does **not** make a provider injectable from other modules (`MailModule`, `AuthModule`) — no other
file currently injects `CacheTokenService`, so it doesn't actually demonstrate cross-module DI.
Since this new logger service must be injectable from `MailModule`/`AuthModule` (consumed by later,
separately-planned issues that migrate their logging onto it and add new logging points), register
it via a dedicated module marked `{ global: true }` instead — mirrors the existing
`JwtModule.registerAsync({ global: true, ... })` pattern already in `app.module.ts`.

Create `backend/src/core/logging.module.ts`:

```ts
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
```

with `{ global: true }` set on the `@Module()` decorator options (or via `Module.forRoot`-style
static method, whichever reads more consistently with the rest of `core/` — no other Core module in
this codebase currently needs a dynamic-module shape, so a plain `{ global: true }`-flagged
`@Module()` is likely simplest).

Import it once, in `AppModule`'s `imports` array, alongside `JwtModule`/`AuthModule`/`MailModule`.
No other module needs to import it directly afterward — any future consumer (`MailModule`,
`AuthModule`, the request-logging interceptor from a later issue) injects `LoggerService` in its
constructor with zero import changes of its own.

## Files to Change

- `backend/src/core/logging.module.ts` (new) — the global module described above.
- `backend/src/app.module.ts` — import the new module.
