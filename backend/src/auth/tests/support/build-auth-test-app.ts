import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createInMemoryRepo } from './in-memory-repo.js';
import { InMemorySessionLookup } from './in-memory-session-lookup.js';
import { AdminGuard } from '../../../core/admin.guard.js';
import { CachePolicyInterceptor } from '../../../core/cache-policy.interceptor.js';
import { HttpExceptionFilter } from '../../../core/http-exception.filter.js';
import { JwtGuard } from '../../../core/jwt.guard.js';
import { LoggingModule } from '../../../core/logging.module.js';
import { OriginGuard } from '../../../core/origin.guard.js';
import { SESSION_LOOKUP } from '../../../core/session-lookup.js';
import { AuthModule } from '../../auth.module.js';
import { DefaultUserConfig, DefaultUserSettings } from '../../default-user.config.js';
import { AccountEditLockout } from '../../entities/account-edit-lockout.entity.js';
import { AuthorizationRequest } from '../../entities/authorization-request.entity.js';
import { PasswordResetToken } from '../../entities/password-reset-token.entity.js';
import { RefreshToken } from '../../entities/refresh-token.entity.js';
import { User } from '../../entities/user.entity.js';

export interface BuildAuthTestAppOptions {
  adminGuard?: boolean;
  registerDefaultUser?: boolean;
  configOverrides?: Record<string, string>;
  controllers?: Type<unknown>[];
  defaultUserSettings?: Partial<DefaultUserSettings>;
  beforeInit?: (repos: { userRepo: ReturnType<typeof createInMemoryRepo<User>> }) => void | Promise<void>;
}

// Baseline for `defaultUserSettings`: the KERGHAN_DEFAULT_USER_* feature off.
const DISABLED_DEFAULT_USER: DefaultUserSettings = {
  enabled: false,
  alwaysAuthenticated: false,
  username: '',
  email: '',
  password: '',
  admin: false,
  allowedIps: [],
  allowInProduction: false,
  stage: 'test',
};

export interface BuildAuthTestAppResult {
  app: INestApplication;
  userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  refreshTokenRepo: ReturnType<typeof createInMemoryRepo<RefreshToken>>;
  passwordResetTokenRepo: ReturnType<typeof createInMemoryRepo<PasswordResetToken>>;
  authorizationRequestRepo: ReturnType<typeof createInMemoryRepo<AuthorizationRequest>>;
  accountEditLockoutRepo: ReturnType<typeof createInMemoryRepo<AccountEditLockout>>;
}

// Builds a fresh app instance wired the same way across every auth e2e spec
// file: registers `ConfigModule`, `EventEmitterModule`, `JwtModule`,
// `LoggingModule`, `AuthModule`, the `APP_GUARD`/`OriginGuard` provider (first,
// as in `AppModule`, so CSRF rejections answer `403` before authentication),
// the `APP_GUARD`/`JwtGuard` provider, and the
// `APP_INTERCEPTOR`/`CachePolicyInterceptor` provider (so `@CachePolicy()`-annotated
// routes still get `X-Skip-Cache`/`Cache-Control` set, as under the real `AppModule`),
// and the `APP_FILTER`/`HttpExceptionFilter` provider (so error responses use
// the standard error body, as under the real `AppModule`);
// overrides the `User`, `RefreshToken`, `PasswordResetToken`,
// `AuthorizationRequest`, and `AccountEditLockout` repository tokens with fresh
// `createInMemoryRepo()` instances; overrides `SESSION_LOOKUP` (used by
// `JwtGuard`'s per-request session gate) with an `InMemorySessionLookup`
// over the in-memory `User`/`RefreshToken` rows, since the real
// `SessionService` query-builder join cannot run on them; and registers the
// `darthjee` test user via
// `POST /auth/register.json`.
//
// Options (defaults preserve the behavior described above):
// - `adminGuard: true` also registers the `APP_GUARD`/`AdminGuard` provider,
//   after `JwtGuard` (order matters: `JwtGuard` must run first so
//   `AdminGuard` sees the authenticated user).
// - `registerDefaultUser: false` skips registering the `darthjee` user, for
//   specs that register their own users.
// - `configOverrides` (non-empty) overrides `ConfigService` with a plain
//   `{ get }` stub reading from it — used by the rate-limiting/abuse-hardening
//   tests to exercise non-default limits without env-var plumbing (every real
//   consumer only ever calls `.get(key)`). When empty, the real `ConfigService`
//   is kept.
// - `controllers` registers extra (throwaway) controllers on the test module.
// - `defaultUserSettings` overrides the `DefaultUserConfig` provider with one
//   built from these settings (on top of a disabled baseline), so default-user
//   boot sync runs against the in-memory user repo during `app.init()`.
// - `beforeInit` runs against the in-memory repos before `app.init()` (and so
//   before boot sync), e.g. to seed rows boot sync should match.
export async function buildAuthTestApp({
  adminGuard = false,
  registerDefaultUser = true,
  configOverrides = {},
  controllers = [],
  defaultUserSettings,
  beforeInit,
}: BuildAuthTestAppOptions = {}): Promise<BuildAuthTestAppResult> {
  const userRepo = createInMemoryRepo<User>();
  const refreshTokenRepo = createInMemoryRepo<RefreshToken>();
  const passwordResetTokenRepo = createInMemoryRepo<PasswordResetToken>();
  const authorizationRequestRepo = createInMemoryRepo<AuthorizationRequest>();
  const accountEditLockoutRepo = createInMemoryRepo<AccountEditLockout>();

  const moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      EventEmitterModule.forRoot(),
      JwtModule.register({ global: true, secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
      LoggingModule,
      AuthModule,
    ],
    controllers,
    providers: [
      { provide: APP_GUARD, useClass: OriginGuard },
      { provide: APP_GUARD, useClass: JwtGuard },
      ...(adminGuard ? [{ provide: APP_GUARD, useClass: AdminGuard }] : []),
      { provide: APP_INTERCEPTOR, useClass: CachePolicyInterceptor },
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
  })
    .overrideProvider(getRepositoryToken(User))
    .useValue(userRepo)
    .overrideProvider(getRepositoryToken(RefreshToken))
    .useValue(refreshTokenRepo)
    .overrideProvider(getRepositoryToken(PasswordResetToken))
    .useValue(passwordResetTokenRepo)
    .overrideProvider(getRepositoryToken(AuthorizationRequest))
    .useValue(authorizationRequestRepo)
    .overrideProvider(getRepositoryToken(AccountEditLockout))
    .useValue(accountEditLockoutRepo)
    .overrideProvider(SESSION_LOOKUP)
    .useValue(new InMemorySessionLookup(userRepo.rows, refreshTokenRepo.rows));

  if (Object.keys(configOverrides).length > 0) {
    moduleBuilder.overrideProvider(ConfigService).useValue({ get: (key: string) => configOverrides[key] });
  }

  if (defaultUserSettings) {
    moduleBuilder
      .overrideProvider(DefaultUserConfig)
      .useValue(new DefaultUserConfig({ ...DISABLED_DEFAULT_USER, ...defaultUserSettings }));
  }

  await beforeInit?.({ userRepo });

  const moduleRef = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  if (registerDefaultUser) {
    await request(app.getHttpServer())
      .post('/auth/register.json')
      .send({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });
  }

  return {
    app,
    userRepo,
    refreshTokenRepo,
    passwordResetTokenRepo,
    authorizationRequestRepo,
    accountEditLockoutRepo,
  };
}
