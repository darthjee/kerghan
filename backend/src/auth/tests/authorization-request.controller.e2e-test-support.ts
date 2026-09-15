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
import { AccountEditLockout } from '../entities/account-edit-lockout.entity.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import { PasswordResetToken } from '../entities/password-reset-token.entity.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { Session } from '../entities/session.entity.js';
import { User } from '../entities/user.entity.js';

// Matches a single condition value against a row's field, understanding
// TypeORM's `IsNull()` find operator in addition to plain equality — see
// `auth.controller.e2e-spec.ts`'s identical helper.
export function matchesCondition(rowValue: unknown, conditionValue: unknown): boolean {
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
export function createInMemoryRepo<T extends { id?: number }>() {
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
