import { randomUUID } from 'node:crypto';
import { inspect } from 'node:util';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { CapturingLauncher } from './capturing-launcher.js';
import { type FakeLogger, HARNESS_START } from './repositories-db-harness.js';
import { AccountHandleService } from '../../../auth/account-handle.service.js';
import { User } from '../../../auth/entities/user.entity.js';
import { CachePolicyInterceptor } from '../../../core/cache-policy.interceptor.js';
import { Clock } from '../../../core/clock.js';
import { HttpExceptionFilter } from '../../../core/http-exception.filter.js';
import { JwtGuard } from '../../../core/jwt.guard.js';
import { LoggerService } from '../../../core/logger.service.js';
import { OriginGuard } from '../../../core/origin.guard.js';
import { SESSION_LOOKUP, type SessionLookup, type SessionUser } from '../../../core/session-lookup.js';
import { FakeClock } from '../../../core/tests/support/fake-clock.js';
import { buildDbTierOptions } from '../../../database/tests/db-tier/db-tier-options.js';
import { IntegrationsGithubService } from '../../../integrations/integrations-github.public.js';
import { FakeIntegrationsGithubService } from '../../../integrations/tests/support/fake-integrations-github.service.js';
import { REPOSITORIES_ENTITIES } from '../../entities/index.js';
import { RepositoriesController } from '../../repositories.controller.js';
import { REPOSITORIES_PROVIDERS } from '../../repositories.module.js';
import { SyncLauncher } from '../../sync-launcher.js';

export { HARNESS_START };

/** Sessions keyed by `sid`, standing in for Auth's session table. */
class MapSessionLookup implements SessionLookup {
  readonly sessions = new Map<string, SessionUser>();

  async findActiveSessionUser(sid: string): Promise<SessionUser | null> {
    return this.sessions.get(sid) ?? null;
  }
}

/** The Repositories routes on real MySQL, with fakes for time, launch, GitHub and logs. */
export interface RepositoriesHttpDbHarness {
  module: TestingModule;
  app: INestApplication;
  ds: DataSource;
  clock: FakeClock;
  launcher: CapturingLauncher;
  github: FakeIntegrationsGithubService;
  logger: FakeLogger;
  /** Mints an access-token cookie for a user (a live session, as a login would issue). */
  sessionFor(userId: number, options?: { isAdmin?: boolean }): string;
  get<T>(token: abstract new (...args: never[]) => T): T;
  /** Every captured log call, rendered as one string (for canary sweeps). */
  loggedText(): string;
  close(): Promise<void>;
}

/**
 * Builds the HTTP app on the DB tier's test database: the real Repositories
 * providers and controller, Auth's real `AccountHandleService`, the global
 * `OriginGuard` / `JwtGuard`, cache interceptor, error filter and
 * `ValidationPipe` as in `AppModule` / `main.ts`, with `FakeClock`,
 * `CapturingLauncher`, `FakeIntegrationsGithubService` and a logger double
 * capturing every log line. Sessions are JWTs bound to an in-memory session
 * map, accepted by the real `JwtGuard`.
 * @param env - Extra config values.
 * @returns The harness; call `close()` in `afterEach`.
 */
export async function buildRepositoriesHttpDbHarness(env: Record<string, string> = {}): Promise<RepositoriesHttpDbHarness> {
  const clock = new FakeClock(HARNESS_START);
  const launcher = new CapturingLauncher();
  const github = new FakeIntegrationsGithubService();
  const logger: FakeLogger & { log: jest.Mock; verbose: jest.Mock } = {
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), verbose: jest.fn(),
  };
  const sessions = new MapSessionLookup();
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, skipProcessEnv: true, load: [() => env] }),
      EventEmitterModule.forRoot(),
      JwtModule.register({ global: true, secret: 'db-test-secret', signOptions: { expiresIn: '15m' } }),
      TypeOrmModule.forRoot({
        ...buildDbTierOptions(),
        migrations: [],
        entities: [...REPOSITORIES_ENTITIES, User],
        poolSize: 10,
      } as never),
      TypeOrmModule.forFeature([...REPOSITORIES_ENTITIES, User]),
    ],
    controllers: [RepositoriesController],
    providers: [
      ...REPOSITORIES_PROVIDERS,
      AccountHandleService,
      { provide: Clock, useValue: clock },
      { provide: SyncLauncher, useValue: launcher },
      { provide: IntegrationsGithubService, useValue: github },
      { provide: LoggerService, useValue: logger },
      { provide: SESSION_LOOKUP, useValue: sessions },
      { provide: APP_GUARD, useClass: OriginGuard },
      { provide: APP_GUARD, useClass: JwtGuard },
      { provide: APP_INTERCEPTOR, useClass: CachePolicyInterceptor },
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
  }).compile();

  const app = module.createNestApplication({ logger: false });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const jwt = app.get(JwtService);

  return {
    module,
    app,
    ds: module.get(DataSource),
    clock,
    launcher,
    github,
    logger,
    sessionFor: (userId, options = {}) => {
      const sid = randomUUID();

      sessions.sessions.set(sid, { id: userId, username: `user-${userId}`, isAdmin: options.isAdmin ?? false });
      return `access_token=${jwt.sign({ sub: userId, sid })}`;
    },
    get: (token) => module.get(token),
    loggedText: () => inspect(Object.values(logger).flatMap((mock) => mock.mock.calls), { depth: 10 }),
    close: () => app.close(),
  };
}

/**
 * Posts to a Repositories route as a given user.
 * @param harness - The harness.
 * @param path - The route.
 * @param cookie - The session cookie.
 * @param body - The JSON body.
 * @returns The pending request.
 */
export function post(harness: RepositoriesHttpDbHarness, path: string, cookie: string, body: Record<string, unknown> = {}): request.Test {
  return request(harness.app.getHttpServer()).post(path).set('Cookie', [cookie]).send(body);
}

/**
 * Polls (on timers: real MySQL I/O sits in between) until `condition` holds.
 * @param condition - The condition.
 * @param what - What is awaited, for the timeout error.
 */
export async function until(condition: () => boolean, what = 'condition'): Promise<void> {
  for (let turn = 0; turn < 2_000; turn += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`until: ${what} never held`);
}

/**
 * Waits until the fake logged `count` calls matching `predicate`.
 * @param harness - The harness.
 * @param predicate - Which calls to count.
 * @param count - How many to wait for.
 */
export async function waitForCalls(
  harness: RepositoriesHttpDbHarness,
  predicate: (call: FakeIntegrationsGithubService['calls'][number]) => boolean,
  count: number,
): Promise<void> {
  await until(() => harness.github.calls.filter(predicate).length >= count, `${count} matching GitHub calls`);
}
