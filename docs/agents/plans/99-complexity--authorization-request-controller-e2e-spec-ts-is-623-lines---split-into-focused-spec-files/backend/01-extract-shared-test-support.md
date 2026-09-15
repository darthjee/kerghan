# Extract shared e2e test support

Create `backend/src/auth/tests/authorization-request.controller.e2e-test-support.ts`, exporting the three module-level helpers currently declared at the top of `authorization-request.controller.e2e-spec.ts` (lines 1–211), unchanged:

- `matchesCondition(rowValue, conditionValue)` — TypeORM find-operator-aware equality check.
- `createInMemoryRepo<T>()` — in-memory fake TypeORM repo (including its `createQueryBuilder().update().set().where().execute()` stub used by the atomic `approved → logged` claim).
- `buildTestApp(configOverrides?)` — builds a `INestApplication` wired with `AuthModule`, overriding every repository with `createInMemoryRepo`, and registers `darthjee`/`darthjee@example.com` via `/auth/register.json`.

Carry over the existing header comments on `matchesCondition` and `createInMemoryRepo` verbatim — they explain non-obvious behavior (the `IsNull()`/`moreThan()` operator handling, and why this fake repo is duplicated per e2e spec file rather than shared with unit-test mocks).

Keep the same imports this code currently needs: `INestApplication`, `ValidationPipe` from `@nestjs/common`; `ConfigModule`, `ConfigService` from `@nestjs/config`; `APP_GUARD` from `@nestjs/core`; `EventEmitterModule` from `@nestjs/event-emitter`; `JwtModule` from `@nestjs/jwt`; `Test` from `@nestjs/testing`; `getRepositoryToken` from `@nestjs/typeorm`; `cookieParser`; `request` from `supertest`; `JwtGuard`; `LoggingModule`; `AuthModule`; and the five entities (`AccountEditLockout`, `AuthorizationRequest`, `PasswordResetToken`, `RefreshToken`, `Session`, `User`).

This file has no `describe`/`it` blocks of its own — it is pure support, imported by the four spec files created in the following steps.

## Files to Change

- `backend/src/auth/tests/authorization-request.controller.e2e-test-support.ts` — new file; `matchesCondition`, `createInMemoryRepo`, `buildTestApp` moved here verbatim from the top of the original spec.
