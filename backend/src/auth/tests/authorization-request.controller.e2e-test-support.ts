import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { JwtGuard } from '../../core/jwt.guard.js';
import { LoggingModule } from '../../core/logging.module.js';
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

// Builds a fresh app instance wired the same way as the outer `beforeEach`, optionally overriding
// `ConfigService#get` with `configOverrides` — used by the rate-limiting/abuse-hardening tests
// below to exercise non-default limits without env-var plumbing. `ConfigService` is itself
// overridden as a plain `{ get }` stub (every real consumer only ever calls `.get(key)`).
export async function buildTestApp(configOverrides: Record<string, string> = {}): Promise<{
  app: INestApplication;
  userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  authorizationRequestRepo: ReturnType<typeof createInMemoryRepo<AuthorizationRequest>>;
}> {
  const userRepo = createInMemoryRepo<User>();
  const refreshTokenRepo = createInMemoryRepo<RefreshToken>();
  const sessionRepo = createInMemoryRepo<Session>();
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
    providers: [
      { provide: APP_GUARD, useClass: JwtGuard },
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
    .useValue(accountEditLockoutRepo);

  if (Object.keys(configOverrides).length > 0) {
    moduleBuilder.overrideProvider(ConfigService).useValue({ get: (key: string) => configOverrides[key] });
  }

  const moduleRef = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  await request(app.getHttpServer())
    .post('/auth/register.json')
    .send({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });

  return { app, userRepo, authorizationRequestRepo };
}

// Raises an authorization request for `username` against `app` and returns its `uuid`/`pollToken`.
export async function createAuthorizationRequest(
  app: INestApplication,
  username = 'darthjee',
): Promise<{ uuid: string; pollToken: string }> {
  const response = await request(app.getHttpServer())
    .post('/auth/authorization-requests.json')
    .send({ username })
    .expect(201);

  return response.body;
}

// Logs `username` in against `app` and returns the `access_token` cookie (`name=value`) to replay
// via `.set('Cookie', [cookie])`.
export async function login(app: INestApplication, username: string, password: string): Promise<string> {
  const response = await request(app.getHttpServer()).post('/auth/login.json').send({ username, password });
  return response.headers['set-cookie'][0].split(';')[0];
}
