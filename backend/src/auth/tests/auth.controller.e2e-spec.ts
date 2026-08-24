import { Controller, Get, INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { JwtGuard } from '../../core/jwt.guard.js';
import { Public } from '../../core/public.decorator.js';
import { AuthModule } from '../auth.module.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { Session } from '../entities/session.entity.js';
import { User } from '../entities/user.entity.js';

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
            Object.entries(condition).every(([key, value]) => (row as never)[key] === value),
          ),
        ) ?? null
      );
    },
    findOneBy: async (where: Partial<T>): Promise<T | null> =>
      rows.find((row) => Object.entries(where).every(([key, value]) => (row as never)[key] === value)) ?? null,
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
            ? Object.entries(criteria).every(([key, value]) => (row as never)[key] === value)
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

  beforeEach(async () => {
    userRepo = createInMemoryRepo<User>();
    refreshTokenRepo = createInMemoryRepo<RefreshToken>();
    const sessionRepo = createInMemoryRepo<Session>();

    const moduleRef = await Test.createTestingModule({
      imports: [
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
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('login flow', () => {
    it('logs in with valid credentials, returning the user and a refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'darthjee', password: 'my-password' })
        .expect(201);

      expect(response.body).toEqual({
        user: { id: expect.any(Number), username: 'darthjee', email: 'darthjee@example.com' },
        refreshToken: expect.any(String),
      });
    });

    it('rejects an invalid password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'darthjee', password: 'wrong-password' })
        .expect(401);
    });

    it('sets the access token as an httpOnly, secure, SameSite=Strict cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'darthjee', password: 'my-password' })
        .expect(201);

      const cookie = response.headers['set-cookie'][0];

      expect(cookie).toMatch(/^access_token=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });
  });

  describe('refresh token rotation', () => {
    it('issues a new token pair and invalidates the old refresh token', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'darthjee', password: 'my-password' });
      const oldRefreshToken = login.body.refreshToken;

      const refreshed = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(201);

      expect(refreshed.body.refreshToken).not.toBe(oldRefreshToken);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);
    });

    it('rejects an expired refresh token', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'darthjee', password: 'my-password' });

      // `rows[0]` is the token issued by `register()` in the outer
      // `beforeEach` — the one under test here is the last one created, by
      // this test's own `login` call.
      refreshTokenRepo.rows[refreshTokenRepo.rows.length - 1].expiresAt = new Date(Date.now() - 1000);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
    });
  });

  describe('logout', () => {
    it('invalidates the refresh token and clears the access-token cookie', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'darthjee', password: 'my-password' });

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: login.body.refreshToken })
        .expect(204);

      expect(response.headers['set-cookie'][0]).toMatch(/^access_token=;/);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
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
        .post('/auth/login')
        .send({ username: 'darthjee', password: 'my-password' });
      const accessTokenCookie = login.headers['set-cookie'][0].split(';')[0];

      await request(app.getHttpServer())
        .get('/protected')
        .set('Cookie', [accessTokenCookie])
        .expect(200, { ok: true });
    });
  });
});
