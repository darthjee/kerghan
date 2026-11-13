import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CapturingLauncher } from './capturing-launcher.js';
import { AccountHandleService } from '../../../auth/account-handle.service.js';
import { User } from '../../../auth/entities/user.entity.js';
import { Clock } from '../../../core/clock.js';
import { LoggerService } from '../../../core/logger.service.js';
import { FakeClock } from '../../../core/tests/support/fake-clock.js';
import { buildDbTierOptions } from '../../../database/tests/db-tier/db-tier-options.js';
import { IntegrationsGithubService } from '../../../integrations/integrations-github.public.js';
import { FakeIntegrationsGithubService } from '../../../integrations/tests/support/fake-integrations-github.service.js';
import { REPOSITORIES_ENTITIES } from '../../entities/index.js';
import { REPOSITORIES_PROVIDERS } from '../../repositories.module.js';
import { SyncLauncher } from '../../sync-launcher.js';

/** The start of the harness's `FakeClock` (whole seconds: `datetime` has no fraction). */
export const HARNESS_START = new Date('2026-06-01T12:00:00Z');

/** A logger double recording every call. */
export interface FakeLogger {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

/** The Repositories providers on real MySQL, with fakes for time, launch, GitHub and logs. */
export interface RepositoriesDbHarness {
  module: TestingModule;
  ds: DataSource;
  clock: FakeClock;
  launcher: CapturingLauncher;
  github: FakeIntegrationsGithubService;
  logger: FakeLogger;
  get<T>(token: abstract new (...args: never[]) => T): T;
  close(): Promise<void>;
}

/**
 * Builds a Nest testing module on the DB tier's test database, wiring the
 * Repositories module's own providers with Auth's real
 * `AccountHandleService`, and `FakeClock`, `CapturingLauncher`,
 * `FakeIntegrationsGithubService` and a fake logger overridden.
 * @param env - Extra config values (e.g. `KERGHAN_REPOSITORIES_SYNC_PAGE_CAP`).
 * @returns The harness; call `close()` in `afterAll`.
 */
export async function buildRepositoriesDbHarness(env: Record<string, string> = {}): Promise<RepositoriesDbHarness> {
  const clock = new FakeClock(HARNESS_START);
  const launcher = new CapturingLauncher();
  const github = new FakeIntegrationsGithubService();
  const logger: FakeLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, skipProcessEnv: true, load: [() => env] }),
      EventEmitterModule.forRoot(),
      TypeOrmModule.forRoot({
        ...buildDbTierOptions(),
        migrations: [],
        entities: [...REPOSITORIES_ENTITIES, User],
        poolSize: 10,
      } as never),
      TypeOrmModule.forFeature([...REPOSITORIES_ENTITIES, User]),
    ],
    providers: [
      ...REPOSITORIES_PROVIDERS,
      AccountHandleService,
      { provide: Clock, useValue: clock },
      { provide: SyncLauncher, useValue: launcher },
      { provide: IntegrationsGithubService, useValue: github },
      { provide: LoggerService, useValue: logger },
    ],
  }).compile();

  await module.init();

  return {
    module,
    ds: module.get(DataSource),
    clock,
    launcher,
    github,
    logger,
    get: (token) => module.get(token),
    close: () => module.close(),
  };
}
