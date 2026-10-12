# Register the provider

Register `DefaultUserConfig` in `AuthModule` as a factory provider so that it is built, and validated, once at boot:

```ts
{
  provide: DefaultUserConfig,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): DefaultUserConfig =>
    DefaultUserConfig.fromConfigService(configService),
},
```

Using the class itself as the token lets #369/#370 inject it by type. Do not export it from the module unless a consumer outside `auth` needs it (none yet). Confirm `ConfigService` is resolvable in `AuthModule` (global `ConfigModule` in `app.module.ts`, as `MailModule` relies on).

Check that existing e2e test modules that build `AuthModule` providers (e.g. `auth.controller.e2e-test-support.ts`) still compile and boot. With no `KERGHAN_DEFAULT_USER_*` set, the config is disabled and validates nothing, so no fixture change should be needed. Add a provider stub only if a test module lists providers explicitly and fails to resolve it.

## Files to Change
- `backend/src/auth/auth.module.ts` — add the factory provider.
- `backend/src/auth/tests/*e2e-test-support.ts` — only if needed to resolve the new provider.
