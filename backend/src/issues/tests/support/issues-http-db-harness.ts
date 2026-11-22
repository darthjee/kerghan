import { randomUUID } from 'node:crypto';
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
import { FakeProjectRepositories } from './fake-project-repositories.js';
import { type FakeLogger, HARNESS_START } from './issues-db-harness.js';
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
import { RepositoriesService } from '../../../repositories/repositories.service.js';
import { ISSUES_ENTITIES } from '../../entities/index.js';
import { IssueLinksController } from '../../issue-links.controller.js';
import { IssuesController } from '../../issues.controller.js';
import { ISSUES_PROVIDERS } from '../../issues.module.js';
import { ProjectsController } from '../../projects.controller.js';

export { HARNESS_START };

/** Sessions keyed by `sid`, standing in for Auth's session table. */
class MapSessionLookup implements SessionLookup {
  readonly sessions = new Map<string, SessionUser>();

  async findActiveSessionUser(sid: string): Promise<SessionUser | null> {
    return this.sessions.get(sid) ?? null;
  }
}

/** The Projects routes on real MySQL, with fakes for time, logs and the Repositories lookups. */
export interface IssuesHttpDbHarness {
  module: TestingModule;
  app: INestApplication;
  ds: DataSource;
  clock: FakeClock;
  logger: FakeLogger;
  repositories: FakeProjectRepositories;
  /** The scripted `IntegrationsGithubService` the link routes read GitHub through. */
  github: FakeIntegrationsGithubService;
  /** Mints an access-token cookie for a user (a live session, as a login would issue). */
  sessionFor(userId: number): string;
  get<T>(token: abstract new (...args: never[]) => T): T;
  close(): Promise<void>;
}

/**
 * Builds the HTTP app on the DB tier's test database: the real Issues providers and
 * `ProjectsController`, Auth's real `AccountHandleService`, the global `OriginGuard` / `JwtGuard`,
 * cache interceptor, error filter and `ValidationPipe` as in `AppModule` / `main.ts`, with
 * `FakeClock`, a logger double and an in-memory `RepositoriesService` lookup double.
 * @param env - Extra config values (e.g. `KERGHAN_ISSUES_MAX_PROJECTS_PER_USER`).
 * @returns The harness; call `close()` in `afterAll`.
 */
export async function buildIssuesHttpDbHarness(env: Record<string, string> = {}): Promise<IssuesHttpDbHarness> {
  const clock = new FakeClock(HARNESS_START);
  const repositories = new FakeProjectRepositories();
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
        entities: [...ISSUES_ENTITIES, User],
        poolSize: 10,
      } as never),
      TypeOrmModule.forFeature([...ISSUES_ENTITIES, User]),
    ],
    controllers: [ProjectsController, IssuesController, IssueLinksController],
    providers: [
      ...ISSUES_PROVIDERS,
      AccountHandleService,
      { provide: Clock, useValue: clock },
      { provide: LoggerService, useValue: logger },
      { provide: RepositoriesService, useValue: repositories },
      { provide: IntegrationsGithubService, useValue: github },
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
    logger,
    repositories,
    github,
    sessionFor: (userId) => {
      const sid = randomUUID();

      sessions.sessions.set(sid, { id: userId, username: `user-${userId}`, isAdmin: false });
      return `access_token=${jwt.sign({ sub: userId, sid })}`;
    },
    get: (token) => module.get(token),
    close: () => app.close(),
  };
}

/**
 * Posts to a Projects route as a given user.
 * @param harness - The harness.
 * @param path - The route.
 * @param cookie - The session cookie.
 * @param body - The JSON body.
 * @returns The pending request.
 */
export function post(harness: IssuesHttpDbHarness, path: string, cookie: string, body: Record<string, unknown> = {}): request.Test {
  return request(harness.app.getHttpServer()).post(path).set('Cookie', [cookie]).send(body);
}
