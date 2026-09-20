import { Controller, Get, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AdminGuard } from '../../core/admin.guard.js';
import { JwtGuard } from '../../core/jwt.guard.js';
import { LoggingModule } from '../../core/logging.module.js';
import { Public } from '../../core/public.decorator.js';
import { SkipCacheInterceptor } from '../../core/skip-cache.interceptor.js';
import { AuthModule } from '../auth.module.js';
import { AccountEditLockout } from '../entities/account-edit-lockout.entity.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import { PasswordResetToken } from '../entities/password-reset-token.entity.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { Session } from '../entities/session.entity.js';
import { User } from '../entities/user.entity.js';
import { createInMemoryRepo, matchesCondition } from './support/in-memory-repo.js';

export { createInMemoryRepo, matchesCondition };

// Throwaway controller used only to exercise the global `JwtGuard` — the
// Auth module's own routes are all `@Public()` by design.
@Controller('protected')
export class ProtectedTestController {
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

@Controller('public')
export class PublicTestController {
  @Public()
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

// Builds a fresh app instance wired the same way across every
// `AuthController (e2e)` spec file: registers `ConfigModule`,
// `EventEmitterModule`, `JwtModule`, `LoggingModule`, `AuthModule`, the two
// `JwtGuard`-exercising test controllers, the `APP_GUARD`/`JwtGuard`
// provider, and the `APP_INTERCEPTOR`/`SkipCacheInterceptor` provider (so
// `@SkipCache()`-annotated routes still get `X-Skip-Cache` set, the same as
// under the real `AppModule`); overrides the `User`, `RefreshToken`,
// `Session`, `PasswordResetToken`, `AuthorizationRequest`, and
// `AccountEditLockout` repository tokens with fresh `createInMemoryRepo()`
// instances; and registers the `darthjee` test user via
// `POST /auth/register.json`.
//
// Options (defaults preserve the behavior described above):
// - `adminGuard: true` also registers the `APP_GUARD`/`AdminGuard` provider,
//   after `JwtGuard` (order matters: `JwtGuard` must run first so
//   `AdminGuard` sees the authenticated user).
// - `registerDefaultUser: false` skips registering the `darthjee` user, for
//   specs that register their own users.
export async function buildTestApp({
  adminGuard = false,
  registerDefaultUser = true,
}: { adminGuard?: boolean; registerDefaultUser?: boolean } = {}): Promise<{
  app: INestApplication;
  userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  refreshTokenRepo: ReturnType<typeof createInMemoryRepo<RefreshToken>>;
  passwordResetTokenRepo: ReturnType<typeof createInMemoryRepo<PasswordResetToken>>;
}> {
  const userRepo = createInMemoryRepo<User>();
  const refreshTokenRepo = createInMemoryRepo<RefreshToken>();
  const sessionRepo = createInMemoryRepo<Session>();
  const passwordResetTokenRepo = createInMemoryRepo<PasswordResetToken>();
  const authorizationRequestRepo = createInMemoryRepo<AuthorizationRequest>();
  const accountEditLockoutRepo = createInMemoryRepo<AccountEditLockout>();

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      EventEmitterModule.forRoot(),
      JwtModule.register({ global: true, secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
      LoggingModule,
      AuthModule,
    ],
    controllers: [ProtectedTestController, PublicTestController],
    providers: [
      { provide: APP_GUARD, useClass: JwtGuard },
      ...(adminGuard ? [{ provide: APP_GUARD, useClass: AdminGuard }] : []),
      { provide: APP_INTERCEPTOR, useClass: SkipCacheInterceptor },
    ],
  })
    .overrideProvider(getRepositoryToken(User))
    .useValue(userRepo)
    .overrideProvider(getRepositoryToken(RefreshToken))
    .useValue(refreshTokenRepo)
    .overrideProvider(getRepositoryToken(Session))
    .useValue(sessionRepo)
    .overrideProvider(getRepositoryToken(PasswordResetToken))
    .useValue(passwordResetTokenRepo)
    .overrideProvider(getRepositoryToken(AuthorizationRequest))
    .useValue(authorizationRequestRepo)
    .overrideProvider(getRepositoryToken(AccountEditLockout))
    .useValue(accountEditLockoutRepo)
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  if (registerDefaultUser) {
    await request(app.getHttpServer())
      .post('/auth/register.json')
      .send({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });
  }

  return { app, userRepo, refreshTokenRepo, passwordResetTokenRepo };
}
