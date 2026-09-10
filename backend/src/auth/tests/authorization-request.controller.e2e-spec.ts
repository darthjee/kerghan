import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
    const operator = conditionValue as { type: string; value: unknown };

    if (operator.type === 'isNull') {
      return rowValue === null || rowValue === undefined;
    }

    if (operator.type === 'moreThan') {
      return (rowValue as Date) > (operator.value as Date);
    }

    return false;
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
    find: async (
      { where, order }: { where?: Partial<T> | Partial<T>[]; order?: Partial<Record<keyof T, 'ASC' | 'DESC'>> } = {},
    ): Promise<T[]> => {
      const conditions = where ? (Array.isArray(where) ? where : [where]) : [];
      const matched =
        conditions.length === 0
          ? [...rows]
          : rows.filter((row) =>
            conditions.some((condition) =>
              Object.entries(condition).every(([key, value]) => matchesCondition((row as never)[key], value)),
            ),
          );

      const [field, direction] = order ? (Object.entries(order)[0] as [string, 'ASC' | 'DESC']) : [];

      if (!field) {
        return matched;
      }

      return matched.sort((a, b) => {
        const diff = new Date((a as never)[field]).getTime() - new Date((b as never)[field]).getTime();
        return direction === 'DESC' ? -diff : diff;
      });
    },
    findOneBy: async (where: Partial<T>): Promise<T | null> =>
      rows.find((row) =>
        Object.entries(where).every(([key, value]) => matchesCondition((row as never)[key], value)),
      ) ?? null,
    count: async ({ where }: { where: Partial<T> }): Promise<number> =>
      rows.filter((row) => Object.entries(where).every(([key, value]) => matchesCondition((row as never)[key], value)))
        .length,
    save: async (entity: T): Promise<T> => {
      if (entity.id === undefined) {
        entity.id = nextId++;
        // Real TypeORM auto-populates `@CreateDateColumn`
        // (`AuthorizationRequest#createdAt`) on insert — this fake repo has
        // to do the same so `listOpenForUser`'s `createdAt` field round-trips.
        (entity as never as { createdAt?: Date }).createdAt ??= new Date();
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

// Builds a fresh app instance wired the same way as the outer `beforeEach`, optionally overriding
// `ConfigService#get` with `configOverrides` — used by the rate-limiting/abuse-hardening tests
// below to exercise non-default limits without env-var plumbing. `ConfigService` is itself
// overridden as a plain `{ get }` stub (every real consumer only ever calls `.get(key)`).
async function buildTestApp(configOverrides: Record<string, string> = {}): Promise<{
  app: INestApplication;
  userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  authorizationRequestRepo: ReturnType<typeof createInMemoryRepo<AuthorizationRequest>>;
}> {
  const userRepo = createInMemoryRepo<User>();
  const refreshTokenRepo = createInMemoryRepo<RefreshToken>();
  const sessionRepo = createInMemoryRepo<Session>();
  const passwordResetTokenRepo = createInMemoryRepo<PasswordResetToken>();
  const authorizationRequestRepo = createInMemoryRepo<AuthorizationRequest>();

  const moduleBuilder = Test.createTestingModule({
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
    .useValue(authorizationRequestRepo);

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

describe('AuthorizationRequestController (e2e)', () => {
  let app: INestApplication;
  let authorizationRequestRepo: ReturnType<typeof createInMemoryRepo<AuthorizationRequest>>;

  beforeEach(async () => {
    ({ app, authorizationRequestRepo } = await buildTestApp());
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

  describe('approver routes', () => {
    let ownerCookie: string;
    let attackerCookie: string;

    async function login(username: string, password: string): Promise<string> {
      const response = await request(app.getHttpServer()).post('/auth/login.json').send({ username, password });
      return response.headers['set-cookie'][0].split(';')[0];
    }

    beforeEach(async () => {
      ownerCookie = await login('darthjee', 'my-password');

      await request(app.getHttpServer())
        .post('/auth/register.json')
        .send({ username: 'vader', email: 'vader@example.com', password: 'attacker-password' });
      attackerCookie = await login('vader', 'attacker-password');
    });

    describe('mine', () => {
      it('rejects an unauthenticated call with 401', async () => {
        await request(app.getHttpServer()).post('/auth/authorization-requests/mine.json').send({}).expect(401);
      });

      it("returns only the caller's own open, non-expired requests, newest first", async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        const response = await request(app.getHttpServer())
          .post('/auth/authorization-requests/mine.json')
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.body).toEqual({
          requests: [
            {
              uuid,
              requestIp: expect.any(String),
              requestUserAgent: expect.any(String),
              createdAt: expect.any(String),
              expiresAt: expect.any(String),
            },
          ],
        });
      });

      it("never returns a request raised against another user's username", async () => {
        await createAuthorizationRequest('vader');

        const response = await request(app.getHttpServer())
          .post('/auth/authorization-requests/mine.json')
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.body).toEqual({ requests: [] });
      });

      it('never returns a request with userId: null (unresolved username)', async () => {
        await createAuthorizationRequest('nobody');

        const response = await request(app.getHttpServer())
          .post('/auth/authorization-requests/mine.json')
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.body).toEqual({ requests: [] });
      });
    });

    describe('authorize', () => {
      it('rejects an unauthenticated call with 401', async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .send({ password: 'my-password' })
          .expect(401);
      });

      it('rejects a wrong password with 400', async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [ownerCookie])
          .send({ password: 'wrong-password' })
          .expect(400);
      });

      it("rejects the attacker authorizing the owner's request with 400", async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [attackerCookie])
          .send({ password: 'attacker-password' })
          .expect(400);
      });

      it('authorizes on the correct password, and a subsequent poll grants credentials exactly once', async () => {
        const { uuid, pollToken } = await createAuthorizationRequest('darthjee');

        const response = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [ownerCookie])
          .send({ password: 'my-password' })
          .expect(201);

        expect(response.body).toEqual({ authorized: true });

        const approvedPoll = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken })
          .expect(201);

        expect(approvedPoll.body).toEqual({
          status: 'approved',
          user: { id: expect.any(Number), username: 'darthjee', email: 'darthjee@example.com', isAdmin: false },
          refreshToken: expect.any(String),
        });

        const secondPoll = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken })
          .expect(201);

        expect(secondPoll.body).toEqual({ status: 'logged' });
      });
    });

    describe('deny', () => {
      it('rejects an unauthenticated call with 401', async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .send({})
          .expect(401);
      });

      it("rejects the attacker denying the owner's request with 400", async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .set('Cookie', [attackerCookie])
          .send({})
          .expect(400);
      });

      it('denies on the owner call, and a subsequent poll returns { status: "denied" }', async () => {
        const { uuid, pollToken } = await createAuthorizationRequest('darthjee');

        const response = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.body).toEqual({ denied: true });

        const pollResponse = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken })
          .expect(201);

        expect(pollResponse.body).toEqual({ status: 'denied' });
      });
    });

    describe('X-Skip-Cache header', () => {
      it('is set on the mine response', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/authorization-requests/mine.json')
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('is set on the authorize response', async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        const response = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [ownerCookie])
          .send({ password: 'my-password' })
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('is set on the deny response', async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        const response = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });
  });

  describe('rate limiting and abuse hardening', () => {
    describe('create — per-IP limit', () => {
      it('rejects the 6th create from the same IP without persisting a row, identically for a known/unknown username', async () => {
        for (let i = 0; i < 5; i += 1) {
          await request(app.getHttpServer())
            .post('/auth/authorization-requests.json')
            .send({ username: `rate-ip-${i}` })
            .expect(201);
        }

        const rowCountBeforeOverLimit = authorizationRequestRepo.rows.length;

        const overLimitUnknown = await request(app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'rate-ip-unknown' })
          .expect(201);

        const overLimitKnown = await request(app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'darthjee' })
          .expect(201);

        expect(overLimitUnknown.body).toEqual({
          uuid: expect.any(String),
          pollToken: expect.any(String),
          expiresAt: expect.any(String),
        });
        expect(overLimitKnown.body).toEqual({
          uuid: expect.any(String),
          pollToken: expect.any(String),
          expiresAt: expect.any(String),
        });
        expect(authorizationRequestRepo.rows.length).toBe(rowCountBeforeOverLimit);
      });
    });

    describe('create — per-username limit', () => {
      async function fillUsernameLimit(username: string): Promise<void> {
        for (let i = 0; i < 5; i += 1) {
          await request(app.getHttpServer())
            .post('/auth/authorization-requests.json')
            .set('X-Forwarded-For', `203.0.113.${i}`)
            .send({ username })
            .expect(201);
        }
      }

      it('rejects the 6th create for the same unknown username from a fresh IP, without persisting a row', async () => {
        await fillUsernameLimit('rate-username-unknown');
        const rowCountBeforeOverLimit = authorizationRequestRepo.rows.length;

        const overLimit = await request(app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .set('X-Forwarded-For', '203.0.113.99')
          .send({ username: 'rate-username-unknown' })
          .expect(201);

        expect(overLimit.body).toEqual({
          uuid: expect.any(String),
          pollToken: expect.any(String),
          expiresAt: expect.any(String),
        });
        expect(authorizationRequestRepo.rows.length).toBe(rowCountBeforeOverLimit);
      });

      it('rejects the 6th create for the same known username from a fresh IP, identically to an unknown username', async () => {
        await fillUsernameLimit('darthjee');
        const rowCountBeforeOverLimit = authorizationRequestRepo.rows.length;

        const overLimit = await request(app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .set('X-Forwarded-For', '203.0.113.99')
          .send({ username: 'darthjee' })
          .expect(201);

        expect(overLimit.body).toEqual({
          uuid: expect.any(String),
          pollToken: expect.any(String),
          expiresAt: expect.any(String),
        });
        expect(authorizationRequestRepo.rows.length).toBe(rowCountBeforeOverLimit);
      });
    });

    describe('create — concurrent open cap', () => {
      let capApp: INestApplication;
      let capRepo: ReturnType<typeof createInMemoryRepo<AuthorizationRequest>>;

      beforeEach(async () => {
        ({ app: capApp, authorizationRequestRepo: capRepo } = await buildTestApp({
          KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT: '100',
          KERGHAN_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER: '2',
        }));
      });

      afterEach(async () => {
        await capApp.close();
      });

      it('evicts the oldest open row (flips it to expired) instead of rejecting once the cap is reached', async () => {
        const first = await request(capApp.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'darthjee' })
          .expect(201);

        await request(capApp.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'darthjee' })
          .expect(201);

        await request(capApp.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'darthjee' })
          .expect(201);

        const firstRow = capRepo.rows.find((row) => row.uuid === first.body.uuid);

        expect(firstRow?.status).toBe('expired');
        expect(capRepo.rows.filter((row) => row.status === 'open').length).toBe(2);
      });
    });

    describe('authorize — cool-off lockout', () => {
      let ownerCookie: string;

      async function login(username: string, password: string): Promise<string> {
        const response = await request(app.getHttpServer()).post('/auth/login.json').send({ username, password });
        return response.headers['set-cookie'][0].split(';')[0];
      }

      beforeEach(async () => {
        ownerCookie = await login('darthjee', 'my-password');
      });

      it(
        'locks the row after the configured max wrong-password attempts, rejecting even the correct password with the same uniform message',
        async () => {
          const { uuid } = await createAuthorizationRequest('darthjee');

          for (let i = 0; i < 5; i += 1) {
            await request(app.getHttpServer())
              .post(`/auth/authorization-requests/${uuid}/authorize.json`)
              .set('Cookie', [ownerCookie])
              .send({ password: 'wrong-password' })
              .expect(400);
          }

          const lockedResponse = await request(app.getHttpServer())
            .post(`/auth/authorization-requests/${uuid}/authorize.json`)
            .set('Cookie', [ownerCookie])
            .send({ password: 'my-password' })
            .expect(400);

          expect(lockedResponse.body.message).toBe('Unable to authorize this request');

          const row = authorizationRequestRepo.rows.find((candidate) => candidate.uuid === uuid);
          expect(row?.status).toBe('open');
        },
        15000,
      );
    });

    describe('DTO length caps', () => {
      it('rejects an oversized username on create with 400', async () => {
        await request(app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'a'.repeat(256) })
          .expect(400);
      });

      it('rejects an oversized password on authorize with 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login.json')
          .send({ username: 'darthjee', password: 'my-password' });
        const ownerCookie = response.headers['set-cookie'][0].split(';')[0];
        const { uuid } = await createAuthorizationRequest('darthjee');

        await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [ownerCookie])
          .send({ password: 'a'.repeat(129) })
          .expect(400);
      });
    });
  });
});
