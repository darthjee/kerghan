import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { FakeProjectRepositories } from './fake-project-repositories.js';
import { seedIntruderEachTest } from './intruder-baseline.js';
import { HARNESS_START } from './issues-db-harness.js';
import { MapSessionLookup } from './issues-http-db-harness.js';
import { type Intruder } from './issues-seeds.js';
import { ScriptedGithub } from './scripted-github.js';
import { AccountHandleService } from '../../../auth/account-handle.service.js';
import { User } from '../../../auth/entities/user.entity.js';
import { AdminGuard } from '../../../core/admin.guard.js';
import { CachePolicyInterceptor } from '../../../core/cache-policy.interceptor.js';
import { Clock } from '../../../core/clock.js';
import { HttpExceptionFilter } from '../../../core/http-exception.filter.js';
import { JwtGuard } from '../../../core/jwt.guard.js';
import { LoggerService } from '../../../core/logger.service.js';
import { LoggingModule } from '../../../core/logging.module.js';
import { OriginGuard } from '../../../core/origin.guard.js';
import { RequestContextMiddleware } from '../../../core/request-context.middleware.js';
import { Scheduler } from '../../../core/scheduler.js';
import { SESSION_LOOKUP } from '../../../core/session-lookup.js';
import { createConsoleSpies, restoreConsoleSpies, type ConsoleSpies } from '../../../core/tests/console-spies.test-support.js';
import { FakeClock } from '../../../core/tests/support/fake-clock.js';
import { FakeScheduler } from '../../../core/tests/support/fake-scheduler.js';
import { buildDbTierOptions } from '../../../database/tests/db-tier/db-tier-options.js';
import { Integration } from '../../../integrations/entities/integration.entity.js';
import { IntegrationsGithubIssueWriter, IntegrationsGithubService } from '../../../integrations/integrations-github.public.js';
import {
  buildGithubServices,
  integrationRowOf,
  type GithubServices,
  type SeedOptions,
} from '../../../integrations/tests/support/integrations-github-harness.js';
import { RepositoriesService } from '../../../repositories/repositories.service.js';
import { FakeWorkersService } from '../../../workers/tests/support/fake-workers.service.js';
import { WorkersService } from '../../../workers/workers.service.js';
import { ISSUES_ENTITIES } from '../../entities/index.js';
import { IssueLinksController } from '../../issue-links.controller.js';
import { IssuesController } from '../../issues.controller.js';
import { ISSUES_PROVIDERS } from '../../issues.module.js';
import { ProjectsController } from '../../projects.controller.js';

const GITHUB_SERVICES = Symbol('GITHUB_SERVICES');

/** What draining the captured jobs did. */
export interface DrainReport {
  /** How many jobs ran (a requeue counts as a new job). */
  jobs: number;
  /** How many `perform()` calls ran, retries included. */
  attempts: number;
}

/**
 * The Issues routes and the real sync job on real MySQL, with the **real** Integrations services
 * (credential decryption, the installation-token cache, the issue client and writer) and GitHub
 * mocked at the `fetch` level, the request-logging chain mounted and every log line captured. Only
 * time, the workers and the Repositories lookups are doubles.
 */
export interface IssuesCanaryHarness {
  module: TestingModule;
  app: INestApplication;
  ds: DataSource;
  clock: FakeClock;
  scheduler: FakeScheduler;
  /** Records every enqueue; `drainJobs()` runs them. */
  workers: FakeWorkersService;
  repositories: FakeProjectRepositories;
  /** The scripted GitHub behind the real clients. */
  github: ScriptedGithub;
  /** The console spies behind the real `LoggerService` (every level). */
  logs: ConsoleSpies;
  /** The real Integrations services (never handed to Issues' own code except through the public classes). */
  integrations: GithubServices;
  /** The intruder seeded before every test. */
  readonly intruder: Intruder;
  sessionFor(userId: number, isAdmin?: boolean): string;
  intruderCookie(): string;
  /** Seeds an integration of the user, its credential encrypted by the real encryption (a canary token by default). */
  seedIntegration(userId: number, options?: SeedOptions): Promise<Integration>;
  /**
   * Runs every captured job with the real `issues.reconcile` job, retrying a failing one up to its
   * `maxRetries` (the clock advancing by its cooldown between attempts), so retry exhaustion runs too.
   */
  drainJobs(): Promise<DrainReport>;
  get<T>(token: abstract new (...args: never[]) => T): T;
  close(): Promise<void>;
}

/**
 * Builds the canary harness. Call it in `beforeAll`.
 * @param env - Extra config values.
 * @returns The harness; call `close()` in `afterAll`.
 */
export async function buildIssuesCanaryHarness(env: Record<string, string> = {}): Promise<IssuesCanaryHarness> {
  const clock = new FakeClock(HARNESS_START);
  const scheduler = new FakeScheduler(clock);
  const workers = new FakeWorkersService();
  const repositories = new FakeProjectRepositories();
  const github = new ScriptedGithub(() => clock.now());
  const sessions = new MapSessionLookup();
  const logs = createConsoleSpies();

  github.install();

  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, skipProcessEnv: true, load: [() => ({ KERGHAN_LOG_LEVEL: 'debug', ...env })] }),
      EventEmitterModule.forRoot(),
      JwtModule.register({ global: true, secret: 'db-test-secret', signOptions: { expiresIn: '15m' } }),
      TypeOrmModule.forRoot({
        ...buildDbTierOptions(),
        migrations: [],
        entities: [...ISSUES_ENTITIES, User, Integration],
        poolSize: 10,
      } as never),
      TypeOrmModule.forFeature([...ISSUES_ENTITIES, User]),
      LoggingModule,
    ],
    controllers: [ProjectsController, IssuesController, IssueLinksController],
    providers: [
      ...ISSUES_PROVIDERS,
      AccountHandleService,
      { provide: Clock, useValue: clock },
      { provide: Scheduler, useValue: scheduler },
      { provide: WorkersService, useValue: workers },
      { provide: RepositoriesService, useValue: repositories },
      {
        provide: GITHUB_SERVICES,
        useFactory: (ds: DataSource, logger: LoggerService) => buildGithubServices(ds.getRepository(Integration), clock, logger),
        inject: [DataSource, LoggerService],
      },
      { provide: IntegrationsGithubService, useFactory: (services: GithubServices) => services.service, inject: [GITHUB_SERVICES] },
      { provide: IntegrationsGithubIssueWriter, useFactory: (services: GithubServices) => services.writer, inject: [GITHUB_SERVICES] },
      { provide: SESSION_LOOKUP, useValue: sessions },
      { provide: APP_GUARD, useClass: OriginGuard },
      { provide: APP_GUARD, useClass: JwtGuard },
      { provide: APP_GUARD, useClass: AdminGuard },
      { provide: APP_INTERCEPTOR, useClass: CachePolicyInterceptor },
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
  }).compile();

  const app = module.createNestApplication({ logger: false });
  const requestLogging = app.get(RequestContextMiddleware);

  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => requestLogging.use(req, res, next));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const jwt = app.get(JwtService);
  const ds = module.get(DataSource);
  const integrations = module.get<GithubServices>(GITHUB_SERVICES);
  const baseline = seedIntruderEachTest(() => ds);
  const sessionFor = (userId: number, isAdmin = false): string => {
    const sid = randomUUID();

    sessions.sessions.set(sid, { id: userId, username: `user-${userId}`, isAdmin });
    return `access_token=${jwt.sign({ sub: userId, sid })}`;
  };
  let seeded = 0;

  return {
    module, app, ds, clock, scheduler, workers, repositories, github, logs, integrations, sessionFor,
    get intruder(): Intruder {
      return baseline.intruder;
    },
    intruderCookie: () => sessionFor(baseline.intruder.userId),
    async seedIntegration(userId, options = {}) {
      seeded += 1;

      return ds.getRepository(Integration).save(integrationRowOf(integrations.encryption, { ...options, userId }, seeded));
    },
    async drainJobs() {
      const report: DrainReport = { jobs: 0, attempts: 0 };

      while (workers.queued > 0) {
        report.jobs += 1;
        if (report.jobs > 500) throw new Error('drainJobs: the queue never empties');

        const job = workers.buildNext();

        for (let attempt = 1; attempt <= job.maxRetries; attempt += 1) {
          report.attempts += 1;

          try {
            await job.perform(workers.logger);
            break;
          } catch (error) {
            workers.errors.push(error);
            clock.advance(job.cooldown ?? 0);
          }
        }
      }

      return report;
    },
    get: (token) => module.get(token),
    async close() {
      baseline.dispose();
      github.restore();
      restoreConsoleSpies(logs);
      await app.close();
    },
  };
}

/**
 * Posts to an Issues route as a given session.
 * @param harness - The harness.
 * @param path - The route.
 * @param cookie - The session cookie.
 * @param body - The JSON body.
 * @returns The pending request.
 */
export function postAs(harness: IssuesCanaryHarness, path: string, cookie: string, body: Record<string, unknown> = {}): request.Test {
  return request(harness.app.getHttpServer()).post(path).set('Cookie', [cookie]).send(body);
}
