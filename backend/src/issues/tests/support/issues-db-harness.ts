import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FakeProjectRepositories } from './fake-project-repositories.js';
import { AccountHandleService } from '../../../auth/account-handle.service.js';
import { User } from '../../../auth/entities/user.entity.js';
import { Clock } from '../../../core/clock.js';
import { LoggerService } from '../../../core/logger.service.js';
import { Scheduler } from '../../../core/scheduler.js';
import { FakeClock } from '../../../core/tests/support/fake-clock.js';
import { FakeScheduler } from '../../../core/tests/support/fake-scheduler.js';
import { buildDbTierOptions } from '../../../database/tests/db-tier/db-tier-options.js';
import { IntegrationsGithubIssueWriter, IntegrationsGithubService } from '../../../integrations/integrations-github.public.js';
import { FakeIntegrationsGithubService } from '../../../integrations/tests/support/fake-integrations-github.service.js';
import { RepositoriesService } from '../../../repositories/repositories.service.js';
import { FakeWorkersService } from '../../../workers/tests/support/fake-workers.service.js';
import { WorkersService } from '../../../workers/workers.service.js';
import { ISSUES_ENTITIES } from '../../entities/index.js';
import { ISSUES_PROVIDERS } from '../../issues.module.js';

/** The start of the harness's `FakeClock` (whole seconds: `datetime` has no fraction). */
export const HARNESS_START = new Date('2026-06-01T12:00:00Z');

/** A logger double recording every call. */
export interface FakeLogger {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

/** The Issues providers on real MySQL, with fakes for time and logs. */
export interface IssuesDbHarness {
  module: TestingModule;
  ds: DataSource;
  clock: FakeClock;
  /** The timer source the rate-limit timers use, driven by `clock`. */
  scheduler: FakeScheduler;
  /** Captures the sync job's registration and enqueues; nothing runs until `runAll()`. */
  workers: FakeWorkersService;
  logger: FakeLogger;
  /** The in-memory Repositories lookups the Projects services call. */
  repositories: FakeProjectRepositories;
  /** The scripted `IntegrationsGithubService` the link routes read GitHub through. */
  github: FakeIntegrationsGithubService;
  get<T>(token: abstract new (...args: never[]) => T): T;
  close(): Promise<void>;
}

/**
 * Builds a Nest testing module on the DB tier's test database, wiring the Issues module's own
 * providers with Auth's real `AccountHandleService`, `FakeClock`, a fake logger and an
 * in-memory `RepositoriesService` lookup double, plus `EventEmitterModule`.
 * @param env - Extra config values (e.g. `KERGHAN_ISSUES_MAX_PROJECTS_PER_USER`).
 * @returns The harness; call `close()` in `afterAll`.
 */
export async function buildIssuesDbHarness(env: Record<string, string> = {}): Promise<IssuesDbHarness> {
  const clock = new FakeClock(HARNESS_START);
  const scheduler = new FakeScheduler(clock);
  const workers = new FakeWorkersService();
  const logger: FakeLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const repositories = new FakeProjectRepositories();
  const github = new FakeIntegrationsGithubService();
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, skipProcessEnv: true, load: [() => env] }),
      EventEmitterModule.forRoot(),
      TypeOrmModule.forRoot({
        ...buildDbTierOptions(),
        migrations: [],
        entities: [...ISSUES_ENTITIES, User],
        poolSize: 10,
      } as never),
      TypeOrmModule.forFeature([...ISSUES_ENTITIES, User]),
    ],
    providers: [
      ...ISSUES_PROVIDERS,
      AccountHandleService,
      { provide: Clock, useValue: clock },
      { provide: Scheduler, useValue: scheduler },
      { provide: WorkersService, useValue: workers },
      { provide: LoggerService, useValue: logger },
      { provide: RepositoriesService, useValue: repositories },
      { provide: IntegrationsGithubService, useValue: github },
      { provide: IntegrationsGithubIssueWriter, useValue: github.asWriter() },
    ],
  }).compile();

  await module.init();

  return {
    module,
    ds: module.get(DataSource),
    clock,
    scheduler,
    workers,
    logger,
    repositories,
    github,
    get: (token) => module.get(token),
    close: () => module.close(),
  };
}
