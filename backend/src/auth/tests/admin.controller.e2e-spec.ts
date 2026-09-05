import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AdminGuard } from '../../core/admin.guard.js';
import { JwtGuard } from '../../core/jwt.guard.js';
import { LoggingModule } from '../../core/logging.module.js';
import { AuthModule } from '../auth.module.js';
import { PasswordResetToken } from '../entities/password-reset-token.entity.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { Session } from '../entities/session.entity.js';
import { User } from '../entities/user.entity.js';

// Standing in for a real database — mirrors `auth.controller.e2e-spec.ts`'s
// in-memory fake-repository pattern (no DB service container in
// `backend_tests` yet).
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
    find: async ({ where }: { where?: Partial<T> | Partial<T>[] } = {}): Promise<T[]> => {
      if (!where) {
        return [...rows];
      }

      const conditions = Array.isArray(where) ? where : [where];
      return rows.filter((row) =>
        conditions.some((condition) =>
          Object.entries(condition).every(([key, value]) => {
            const rowValue = (row as never)[key] as string;
            const matcher = value as { type?: string; value?: string };
            return matcher?.type === 'ilike'
              ? rowValue.toLowerCase().includes(String(matcher.value).replace(/%/g, '').toLowerCase())
              : rowValue === value;
          }),
        ),
      );
    },
    findOneBy: async (where: Partial<T>): Promise<T | null> =>
      rows.find((row) => Object.entries(where).every(([key, value]) => (row as never)[key] === value)) ??
      null,
    save: async (entity: T): Promise<T> => {
      if (entity.id === undefined) {
        entity.id = nextId++;
        // Real TypeORM auto-populates `@CreateDateColumn`/`@UpdateDateColumn`
        // (e.g. `User#createdAt`) on insert — this fake repo has to do the
        // same so the admin search endpoint's `createdAt` field round-trips.
        (entity as never as { createdAt?: Date }).createdAt ??= new Date();
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

describe('AdminController (e2e)', () => {
  let app: INestApplication;
  let userRepo: ReturnType<typeof createInMemoryRepo<User>>;

  async function registerAndLogin(username: string, email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register.json')
      .send({ username, email, password: 'my-password' });

    const login = await request(app.getHttpServer())
      .post('/auth/login.json')
      .send({ username, password: 'my-password' });

    return login.headers['set-cookie'][0].split(';')[0];
  }

  beforeEach(async () => {
    userRepo = createInMemoryRepo<User>();
    const refreshTokenRepo = createInMemoryRepo<RefreshToken>();
    const sessionRepo = createInMemoryRepo<Session>();
    const passwordResetTokenRepo = createInMemoryRepo<PasswordResetToken>();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        JwtModule.register({ global: true, secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
        LoggingModule,
        AuthModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtGuard },
        { provide: APP_GUARD, useClass: AdminGuard },
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
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('when the caller is unauthenticated', () => {
    it('rejects users/search.json with 401', async () => {
      await request(app.getHttpServer()).post('/admin/users/search.json').send({}).expect(401);
    });

    it('rejects recovery-link.json with 401', async () => {
      await request(app.getHttpServer()).post('/admin/users/1/recovery-link.json').expect(401);
    });

    it('rejects send-recovery-email.json with 401', async () => {
      await request(app.getHttpServer()).post('/admin/users/1/send-recovery-email.json').expect(401);
    });
  });

  describe('when the caller is authenticated but not an admin', () => {
    let cookie: string;

    beforeEach(async () => {
      cookie = await registerAndLogin('darthjee', 'darthjee@example.com');
    });

    it('rejects users/search.json with 403', async () => {
      await request(app.getHttpServer())
        .post('/admin/users/search.json')
        .set('Cookie', [cookie])
        .send({})
        .expect(403);
    });

    it('rejects recovery-link.json with 403', async () => {
      await request(app.getHttpServer())
        .post('/admin/users/1/recovery-link.json')
        .set('Cookie', [cookie])
        .expect(403);
    });

    it('rejects send-recovery-email.json with 403', async () => {
      await request(app.getHttpServer())
        .post('/admin/users/1/send-recovery-email.json')
        .set('Cookie', [cookie])
        .expect(403);
    });
  });

  describe('when the caller is an admin', () => {
    let adminCookie: string;
    let targetUserId: number;

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/auth/register.json')
        .send({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });
      targetUserId = userRepo.rows[0].id as number;

      await request(app.getHttpServer())
        .post('/auth/register.json')
        .send({ username: 'obi-wan', email: 'obi-wan@example.com', password: 'my-password' });
      const adminRow = userRepo.rows.find((row) => row.username === 'obi-wan')!;
      adminRow.isAdmin = true;

      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'obi-wan', password: 'my-password' });
      adminCookie = login.headers['set-cookie'][0].split(';')[0];
    });

    describe('POST /admin/users/search.json', () => {
      it('returns every user when q is omitted', async () => {
        const response = await request(app.getHttpServer())
          .post('/admin/users/search.json')
          .set('Cookie', [adminCookie])
          .send({})
          .expect(201);

        expect(response.body.users).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: targetUserId,
              username: 'darthjee',
              email: 'darthjee@example.com',
              isAdmin: false,
              createdAt: expect.any(String),
            }),
          ]),
        );
      });

      it('filters by q against username/email', async () => {
        const response = await request(app.getHttpServer())
          .post('/admin/users/search.json')
          .set('Cookie', [adminCookie])
          .send({ q: 'darth' })
          .expect(201);

        expect(response.body.users).toHaveLength(1);
        expect(response.body.users[0]).toEqual(expect.objectContaining({ username: 'darthjee' }));
      });

      it('sets the X-Skip-Cache header', async () => {
        const response = await request(app.getHttpServer())
          .post('/admin/users/search.json')
          .set('Cookie', [adminCookie])
          .send({})
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });

    describe('POST /admin/users/:id/recovery-link.json', () => {
      it('mints a fresh recovery link for an existing user', async () => {
        const response = await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/recovery-link.json`)
          .set('Cookie', [adminCookie])
          .expect(201);

        expect(response.body).toEqual({
          resetUrl: expect.stringMatching(/\/#\/recover-password\?token=.+$/),
        });
      });

      it('sets the X-Skip-Cache header', async () => {
        const response = await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/recovery-link.json`)
          .set('Cookie', [adminCookie])
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('responds 404 for an unknown user id', async () => {
        await request(app.getHttpServer())
          .post('/admin/users/999999/recovery-link.json')
          .set('Cookie', [adminCookie])
          .expect(404);
      });
    });

    describe('POST /admin/users/:id/send-recovery-email.json', () => {
      it('responds with a sent boolean for an existing user', async () => {
        const response = await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/send-recovery-email.json`)
          .set('Cookie', [adminCookie])
          .expect(201);

        expect(response.body).toEqual({ sent: expect.any(Boolean) });
      });

      it('sets the X-Skip-Cache header', async () => {
        const response = await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/send-recovery-email.json`)
          .set('Cookie', [adminCookie])
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('responds 404 for an unknown user id', async () => {
        await request(app.getHttpServer())
          .post('/admin/users/999999/send-recovery-email.json')
          .set('Cookie', [adminCookie])
          .expect(404);
      });
    });
  });
});
