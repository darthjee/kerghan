import { Controller, Get, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { JwtGuard } from '../../core/jwt.guard.js';
import { Public } from '../../core/public.decorator.js';
import { AuthModule } from '../auth.module.js';
import { PasswordResetToken } from '../entities/password-reset-token.entity.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { Session } from '../entities/session.entity.js';
import { User } from '../entities/user.entity.js';

// Matches a single condition value against a row's field, understanding
// TypeORM's `IsNull()` find operator (used by `AuthService#revokeTokenFamily`)
// in addition to plain equality — real TypeORM/MySQL handles it natively,
// this in-memory stand-in needs to special-case it.
function matchesCondition(rowValue: unknown, conditionValue: unknown): boolean {
  if (conditionValue && typeof conditionValue === 'object' && 'type' in conditionValue) {
    const operator = conditionValue as { type: string };
    return operator.type === 'isNull' ? rowValue === null || rowValue === undefined : false;
  }

  return rowValue === conditionValue;
}

// Standing in for a real database, mirroring the CI comment on
// `backend_tests`'s "No DB service container yet" strategy: backend specs
// inject mocked TypeORM repositories rather than hitting a live database.
function createInMemoryRepo<T extends { id?: number }>() {
  const rows: T[] = [];
  let nextId = 1;

  return {
    rows,
    create: (attrs: Partial<T>): T => ({ ...attrs }) as T,
    findOne: async ({ where }: { where: Partial<T> | Partial<T>[] }): Promise<T | null> => {
      const conditions = Array.isArray(where) ? where : [where];
      return (
        rows.find((row) =>
          conditions.some((condition) =>
            Object.entries(condition).every(([key, value]) => matchesCondition((row as never)[key], value)),
          ),
        ) ?? null
      );
    },
    findOneBy: async (where: Partial<T>): Promise<T | null> =>
      rows.find((row) =>
        Object.entries(where).every(([key, value]) => matchesCondition((row as never)[key], value)),
      ) ?? null,
    save: async (entity: T): Promise<T> => {
      if (entity.id === undefined) {
        entity.id = nextId++;
        rows.push(entity);
      }
      return entity;
    },
    update: async (criteria: number | Partial<T>, partial: Partial<T>): Promise<void> => {
      rows.forEach((row) => {
        const matches =
          typeof criteria === 'object'
            ? Object.entries(criteria).every(([key, value]) => matchesCondition((row as never)[key], value))
            : row.id === criteria;

        if (matches) {
          Object.assign(row, partial);
        }
      });
    },
  };
}

// Throwaway controller used only to exercise the global `JwtGuard` — the
// Auth module's own routes are all `@Public()` by design.
@Controller('protected')
class ProtectedTestController {
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

@Controller('public')
class PublicTestController {
  @Public()
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  let refreshTokenRepo: ReturnType<typeof createInMemoryRepo<RefreshToken>>;
  let passwordResetTokenRepo: ReturnType<typeof createInMemoryRepo<PasswordResetToken>>;

  beforeEach(async () => {
    userRepo = createInMemoryRepo<User>();
    refreshTokenRepo = createInMemoryRepo<RefreshToken>();
    const sessionRepo = createInMemoryRepo<Session>();
    passwordResetTokenRepo = createInMemoryRepo<PasswordResetToken>();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        JwtModule.register({ global: true, secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
        AuthModule,
      ],
      controllers: [ProtectedTestController, PublicTestController],
      providers: [{ provide: APP_GUARD, useClass: JwtGuard }],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(userRepo)
      .overrideProvider(getRepositoryToken(RefreshToken))
      .useValue(refreshTokenRepo)
      .overrideProvider(getRepositoryToken(Session))
      .useValue(sessionRepo)
      .overrideProvider(getRepositoryToken(PasswordResetToken))
      .useValue(passwordResetTokenRepo)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    await request(app.getHttpServer())
      .post('/auth/register.json')
      .send({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('login flow', () => {
    it('logs in with valid credentials, returning the user and a refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' })
        .expect(201);

      expect(response.body).toEqual({
        user: {
          id: expect.any(Number),
          username: 'darthjee',
          email: 'darthjee@example.com',
          isAdmin: false,
        },
        refreshToken: expect.any(String),
      });
    });

    it('rejects an invalid password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'wrong-password' })
        .expect(401);
    });

    it('sets the access token as an httpOnly, secure, SameSite=Strict cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' })
        .expect(201);

      const cookie = response.headers['set-cookie'][0];

      expect(cookie).toMatch(/^access_token=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });
  });

  describe('recover flow', () => {
    it('responds 200 { sent: true } for an email that matches an account', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/recover.json')
        .send({ email: 'darthjee@example.com' })
        .expect(200);

      expect(response.body).toEqual({ sent: true });
    });

    it('responds 200 { sent: true } for an email that does not match any account', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/recover.json')
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect(response.body).toEqual({ sent: true });
    });

    it('sets the X-Skip-Cache header', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/recover.json')
        .send({ email: 'darthjee@example.com' })
        .expect(200);

      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('creates a password-reset token only when the email matches an account', async () => {
      await request(app.getHttpServer())
        .post('/auth/recover.json')
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect(passwordResetTokenRepo.rows).toHaveLength(0);

      await request(app.getHttpServer())
        .post('/auth/recover.json')
        .send({ email: 'darthjee@example.com' })
        .expect(200);

      expect(passwordResetTokenRepo.rows).toHaveLength(1);
    });
  });

  describe('reset-password flow', () => {
    // Captures the plaintext token from the fired event, standing in for
    // the recovery-email listener that #39 will add — this issue's own
    // code never returns the plaintext token over HTTP.
    async function requestRecoveryToken(email: string): Promise<string> {
      const eventEmitter = app.get(EventEmitter2);
      const tokenPromise = new Promise<string>((resolve) => {
        eventEmitter.once('password-recovery.requested', (event: { token: string }) => {
          resolve(event.token);
        });
      });

      await request(app.getHttpServer()).post('/auth/recover.json').send({ email });

      return tokenPromise;
    }

    it('resets the password and responds 200 { reset: true }', async () => {
      const token = await requestRecoveryToken('darthjee@example.com');

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'brand-new-password' })
        .expect(200);

      expect(response.body).toEqual({ reset: true });

      await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'brand-new-password' })
        .expect(201);
    });

    it('sets the X-Skip-Cache header', async () => {
      const token = await requestRecoveryToken('darthjee@example.com');

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'brand-new-password' })
        .expect(200);

      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('revokes the user\'s other refresh tokens on success', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });
      const token = await requestRecoveryToken('darthjee@example.com');

      await request(app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'brand-new-password' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
    });

    it('rejects an unknown token with a 400 whose body carries a message field, not 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token: 'not-a-real-token', password: 'brand-new-password' })
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({ statusCode: 400, message: expect.any(String) }),
      );
    });

    it('rejects an already-used token', async () => {
      const token = await requestRecoveryToken('darthjee@example.com');

      await request(app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'brand-new-password' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'yet-another-password' })
        .expect(400);
    });

    it('rejects an expired token', async () => {
      const token = await requestRecoveryToken('darthjee@example.com');
      passwordResetTokenRepo.rows[passwordResetTokenRepo.rows.length - 1].expiresAt = new Date(
        Date.now() - 1000,
      );

      await request(app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'brand-new-password' })
        .expect(400);
    });

    it('rejects a too-short password with a 400, without touching the token', async () => {
      const token = await requestRecoveryToken('darthjee@example.com');

      await request(app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'short' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'brand-new-password' })
        .expect(200);
    });
  });

  describe('access-token cookie maxAge', () => {
    it('defaults to 900 seconds (15 minutes) when KERGHAN_ACCESS_TOKEN_TTL_MS is unset', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' })
        .expect(201);

      const cookie = response.headers['set-cookie'][0];

      expect(cookie).toMatch(/Max-Age=900\b/);
    });
  });

  describe('refresh token rotation', () => {
    it('issues a new token pair and invalidates the old refresh token', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });
      const oldRefreshToken = login.body.refreshToken;

      const refreshed = await request(app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: oldRefreshToken })
        .expect(201);

      expect(refreshed.body.refreshToken).not.toBe(oldRefreshToken);

      await request(app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);
    });

    it('rejects an expired refresh token', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });

      // `rows[0]` is the token issued by `register()` in the outer
      // `beforeEach` — the one under test here is the last one created, by
      // this test's own `login` call.
      refreshTokenRepo.rows[refreshTokenRepo.rows.length - 1].expiresAt = new Date(Date.now() - 1000);

      await request(app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
    });
  });

  describe('logout', () => {
    it('invalidates the refresh token and clears the access-token cookie', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });

      const response = await request(app.getHttpServer())
        .delete('/auth/logoff.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(204);

      expect(response.headers['set-cookie'][0]).toMatch(/^access_token=;/);

      await request(app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
    });
  });

  describe('status check', () => {
    it('resolves loggedIn: true for an active refresh token', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });

      const response = await request(app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(response.body).toEqual({ loggedIn: true, isAdmin: false });
    });

    it('resolves loggedIn: false for an unknown refresh token, without a 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: 'not-a-real-token' })
        .expect(201);

      expect(response.body).toEqual({ loggedIn: false, isAdmin: false });
    });

    it('resolves loggedIn: false for a revoked refresh token, without revoking the token family', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });

      await request(app.getHttpServer())
        .delete('/auth/logoff.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(204);

      const response = await request(app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(response.body).toEqual({ loggedIn: false, isAdmin: false });
    });

    it('resolves isAdmin: true for an active refresh token belonging to an admin', async () => {
      userRepo.rows[0].isAdmin = true;

      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });

      const response = await request(app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(response.body).toEqual({ loggedIn: true, isAdmin: true });
    });

    it('does not set or clear the access-token cookie', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });

      const response = await request(app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('is reachable without an access-token cookie, being @Public()', async () => {
      await request(app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: 'whatever' })
        .expect(201);
    });

    it('sets the X-Skip-Cache header', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: 'whatever' })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });

  describe('X-Skip-Cache header', () => {
    it('is set on the login response, so Tent never caches it across users', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('is set on the register response', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register.json')
        .send({ username: 'obi-wan', email: 'obi-wan@example.com', password: 'another-password' })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('is set on the refresh response', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('is set on the logout response', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });

      const response = await request(app.getHttpServer())
        .delete('/auth/logoff.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(204);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });

  describe('JwtGuard', () => {
    it('allows a public route through without a token', async () => {
      await request(app.getHttpServer()).get('/public').expect(200);
    });

    it('rejects a protected route with no access token', async () => {
      await request(app.getHttpServer()).get('/protected').expect(401);
    });

    it('rejects a protected route with an invalid access token', async () => {
      await request(app.getHttpServer())
        .get('/protected')
        .set('Cookie', ['access_token=not-a-valid-jwt'])
        .expect(401);
    });

    it('allows a protected route with a valid access token', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });
      const accessTokenCookie = login.headers['set-cookie'][0].split(';')[0];

      await request(app.getHttpServer())
        .get('/protected')
        .set('Cookie', [accessTokenCookie])
        .expect(200, { ok: true });
    });
  });
});
