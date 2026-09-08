import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { JwtGuard } from '../../core/jwt.guard.js';
import { LoggingModule } from '../../core/logging.module.js';
import { AuthModule } from '../auth.module.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import { PasswordResetToken } from '../entities/password-reset-token.entity.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { Session } from '../entities/session.entity.js';
import { User } from '../entities/user.entity.js';

// Matches a single condition value against a row's field, understanding
// TypeORM's `IsNull()` find operator in addition to plain equality — see
// `auth.controller.e2e-spec.ts`'s identical helper.
function matchesCondition(rowValue: unknown, conditionValue: unknown): boolean {
  if (conditionValue && typeof conditionValue === 'object' && 'type' in conditionValue) {
    const operator = conditionValue as { type: string };
    return operator.type === 'isNull' ? rowValue === null || rowValue === undefined : false;
  }

  return rowValue === conditionValue;
}

// Local copy of the in-memory fake repository (per the standing note:
// `createInMemoryRepo` is duplicated per e2e spec file, not shared) —
// extended here with a `createQueryBuilder().update().set().where().execute()`
// stub, needed by `AuthorizationRequestService`'s atomic `approved → logged`
// claim. No live database in CI (`backend_tests` has no DB service
// container) — the guarded `UPDATE ... WHERE status = 'approved'` is
// simulated by checking+mutating the matching row synchronously inside
// `execute()`, so two concurrent callers still race exactly like a real
// guarded SQL `UPDATE` would.
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
    createQueryBuilder: () => {
      let setPayload: Record<string, unknown> = {};
      let whereParams: Record<string, unknown> = {};
      const builder = {
        update: (): typeof builder => builder,
        set: (payload: Record<string, unknown>): typeof builder => {
          setPayload = payload;
          return builder;
        },
        where: (_sql: string, params: Record<string, unknown>): typeof builder => {
          whereParams = params;
          return builder;
        },
        execute: async (): Promise<{ affected: number }> => {
          const row = rows.find(
            (candidate) => (candidate as never)['uuid'] === whereParams.uuid && (candidate as never)['status'] === 'approved',
          );

          if (!row) {
            return { affected: 0 };
          }

          Object.entries(setPayload).forEach(([key, value]) => {
            (row as never)[key] = typeof value === 'function' ? new Date() : value;
          });

          return { affected: 1 };
        },
      };

      return builder;
    },
  };
}

describe('AuthorizationRequestController (e2e)', () => {
  let app: INestApplication;
  let userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  let authorizationRequestRepo: ReturnType<typeof createInMemoryRepo<AuthorizationRequest>>;

  beforeEach(async () => {
    userRepo = createInMemoryRepo<User>();
    const refreshTokenRepo = createInMemoryRepo<RefreshToken>();
    const sessionRepo = createInMemoryRepo<Session>();
    const passwordResetTokenRepo = createInMemoryRepo<PasswordResetToken>();
    authorizationRequestRepo = createInMemoryRepo<AuthorizationRequest>();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        JwtModule.register({ global: true, secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
        LoggingModule,
        AuthModule,
      ],
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
      .overrideProvider(getRepositoryToken(AuthorizationRequest))
      .useValue(authorizationRequestRepo)
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

  async function createAuthorizationRequest(username = 'darthjee'): Promise<{ uuid: string; pollToken: string }> {
    const response = await request(app.getHttpServer())
      .post('/auth/authorization-requests.json')
      .send({ username })
      .expect(201);

    return response.body;
  }

  function approve(uuid: string): void {
    const row = authorizationRequestRepo.rows.find((candidate) => candidate.uuid === uuid);

    if (row) {
      row.status = 'approved';
    }
  }

  describe('create', () => {
    it('returns { uuid, pollToken, expiresAt } for a matching username', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'darthjee' })
        .expect(201);

      expect(response.body).toEqual({
        uuid: expect.any(String),
        pollToken: expect.any(String),
        expiresAt: expect.any(String),
      });
    });

    it('returns the same shape for a non-matching username', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'nobody' })
        .expect(201);

      expect(response.body).toEqual({
        uuid: expect.any(String),
        pollToken: expect.any(String),
        expiresAt: expect.any(String),
      });
    });

    it('sets the X-Skip-Cache header', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'darthjee' })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });

  describe('full poll flow', () => {
    it('goes open -> approved (Set-Cookie + refreshToken) -> logged (no credentials)', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest();

      const openResponse = await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(openResponse.body).toEqual({ status: 'open' });

      approve(uuid);

      const approvedResponse = await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(approvedResponse.body).toEqual({
        status: 'approved',
        user: { id: expect.any(Number), username: 'darthjee', email: 'darthjee@example.com', isAdmin: false },
        refreshToken: expect.any(String),
      });
      expect(approvedResponse.headers['set-cookie'][0]).toMatch(/^access_token=/);

      const loggedResponse = await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(loggedResponse.body).toEqual({ status: 'logged' });
      expect(loggedResponse.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('expiry path', () => {
    it('flips an overdue open request to expired', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest();
      const row = authorizationRequestRepo.rows.find((candidate) => candidate.uuid === uuid);
      row!.expiresAt = new Date(Date.now() - 1000);

      const response = await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(response.body).toEqual({ status: 'expired' });
    });
  });

  describe('wrong poll token', () => {
    it('returns 404, indistinguishable from an unknown uuid', async () => {
      const { uuid } = await createAuthorizationRequest();

      await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken: 'wrong-token' })
        .expect(404);
    });

    it('returns 404 for an unknown uuid', async () => {
      await request(app.getHttpServer())
        .post('/auth/authorization-requests/not-a-real-uuid/poll.json')
        .send({ pollToken: 'whatever' })
        .expect(404);
    });
  });

  describe('concurrent post-approval polls', () => {
    it('grants credentials to exactly one of two simultaneous polls', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest();
      approve(uuid);

      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken }),
        request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken }),
      ]);

      const statuses = [first.body.status, second.body.status].sort();

      expect(statuses).toEqual(['approved', 'logged']);
    });
  });

  describe('X-Skip-Cache header', () => {
    it('is set on every poll response', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest();

      const response = await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });
});
