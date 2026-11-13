import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { CapturingLauncher } from './capturing-launcher.js';
import { FakeRepositoriesService } from './fake-repositories.service.js';
import { AuthModule } from '../../../auth/auth.module.js';
import { AccountEditLockout } from '../../../auth/entities/account-edit-lockout.entity.js';
import { AuthorizationRequest } from '../../../auth/entities/authorization-request.entity.js';
import { PasswordResetToken } from '../../../auth/entities/password-reset-token.entity.js';
import { RefreshToken } from '../../../auth/entities/refresh-token.entity.js';
import { User } from '../../../auth/entities/user.entity.js';
import { createInMemoryRepo } from '../../../auth/tests/support/in-memory-repo.js';
import { InMemorySessionLookup } from '../../../auth/tests/support/in-memory-session-lookup.js';
import { TokenService } from '../../../auth/token.service.js';
import { AdminGuard } from '../../../core/admin.guard.js';
import { CachePolicyInterceptor } from '../../../core/cache-policy.interceptor.js';
import { Clock } from '../../../core/clock.js';
import { HttpExceptionFilter } from '../../../core/http-exception.filter.js';
import { JwtGuard } from '../../../core/jwt.guard.js';
import { LoggingModule } from '../../../core/logging.module.js';
import { OriginGuard } from '../../../core/origin.guard.js';
import { SESSION_LOOKUP } from '../../../core/session-lookup.js';
import { createConsoleSpies, type ConsoleSpies } from '../../../core/tests/console-spies.test-support.js';
import { FakeClock } from '../../../core/tests/support/fake-clock.js';
import { type IntegrationRef, IntegrationsGithubService } from '../../../integrations/integrations-github.public.js';
import { FakeIntegrationsGithubService } from '../../../integrations/tests/support/fake-integrations-github.service.js';
import { RepositoriesConfig } from '../../repositories-config.js';
import { RepositoriesHttpService } from '../../repositories-http.service.js';
import { RepositoriesController } from '../../repositories.controller.js';
import { RepositoriesService } from '../../repositories.service.js';
import { RepositoryAddRateLimiter } from '../../repository-add-rate-limiter.js';
import { RepositoryAddService } from '../../repository-add.service.js';
import { SyncLauncher } from '../../sync-launcher.js';

/** The start of the app's `FakeClock`. */
export const APP_START = new Date('2026-11-07T12:00:00Z');
/** The `githubId` both the owner and the intruder hold. */
export const SHARED_GITHUB_ID = 4_000_000_001;
/** A `githubId` only the intruder holds. */
export const INTRUDER_ONLY_GITHUB_ID = 4_000_000_002;
/** A `githubId` nobody holds. */
export const MISSING_GITHUB_ID = 4_000_000_999;

/** The owner's integration. */
export const OWNER_INTEGRATION: IntegrationRef = { id: 11, uuid: '11111111-1111-4111-8111-111111111111', label: 'work-pat', type: 'pat' };
/** The intruder's own integration. */
export const INTRUDER_INTEGRATION: IntegrationRef = { id: 22, uuid: '22222222-2222-4222-8222-222222222222', label: 'evil-pat', type: 'pat' };

/** The running app and the doubles behind it. */
export interface RepositoriesTestContext {
  app: INestApplication;
  repositories: FakeRepositoriesService;
  github: FakeIntegrationsGithubService;
  clock: FakeClock;
  launcher: CapturingLauncher;
  userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  ids: { owner: number; intruder: number; admin: number };
  /** Cookie of `darthjee` (the main user). */
  owner: string;
  /** Cookie of `intruder` (another, non-admin user). */
  intruder: string;
  /** Cookie of `boss` (an admin). */
  admin: string;
}

/**
 * Seeds the two-user baseline: the owner and the intruder both hold
 * `SHARED_GITHUB_ID`, each through an integration of their own; the intruder
 * alone holds `INTRUDER_ONLY_GITHUB_ID`. The admin holds nothing.
 * @param {RepositoriesTestContext} ctx - The context.
 * @returns {void}
 */
function seedBaseline(ctx: RepositoriesTestContext): void {
  const { owner, intruder } = ctx.ids;

  ctx.github.setUsable(owner, [OWNER_INTEGRATION]).setUsable(intruder, [INTRUDER_INTEGRATION]);
  ctx.repositories
    .seed(owner, {
      githubId: SHARED_GITHUB_ID,
      owner: 'darthjee',
      name: 'kerghan',
      holderIntegrationIds: [OWNER_INTEGRATION.id],
      sources: [{ kind: 'integration', integration: { uuid: OWNER_INTEGRATION.uuid, label: OWNER_INTEGRATION.label } }],
    })
    .seed(intruder, {
      githubId: SHARED_GITHUB_ID,
      owner: 'darthjee',
      name: 'kerghan',
      holderIntegrationIds: [INTRUDER_INTEGRATION.id],
      sources: [{ kind: 'integration', integration: { uuid: INTRUDER_INTEGRATION.uuid, label: INTRUDER_INTEGRATION.label } }],
    })
    .seed(intruder, { githubId: INTRUDER_ONLY_GITHUB_ID, owner: 'evil', name: 'secret', holderIntegrationIds: [INTRUDER_INTEGRATION.id] });
}

/**
 * Builds the app: Auth plus the Repositories controller over the real
 * `RepositoriesHttpService`, `RepositoryAddService` and rate limiter, with
 * the global guards, interceptor, filter and `ValidationPipe` as in
 * `AppModule` / `main.ts`. `RepositoriesService` (raw MySQL) is replaced by
 * `FakeRepositoriesService`, GitHub by `FakeIntegrationsGithubService`, time
 * by `FakeClock`, the launcher by `CapturingLauncher`. Logs in the owner, an
 * intruder and an admin, and seeds the two-user baseline.
 * @param {Record<string, unknown>} [env] - Config overrides (e.g. the Add rate limit).
 * @returns {Promise<RepositoriesTestContext>} The context.
 */
export async function buildRepositoriesTestApp(env: Record<string, unknown> = {}): Promise<RepositoriesTestContext> {
  const config: Record<string, unknown> = { KERGHAN_LOG_LEVEL: 'debug', ...env };
  const clock = new FakeClock(APP_START);
  const repositories = new FakeRepositoriesService().setNow(() => clock.now());
  const github = new FakeIntegrationsGithubService();
  const launcher = new CapturingLauncher();
  const userRepo = createInMemoryRepo<User>();
  const refreshTokenRepo = createInMemoryRepo<RefreshToken>();

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      EventEmitterModule.forRoot(),
      JwtModule.register({ global: true, secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
      LoggingModule,
      AuthModule,
    ],
    controllers: [RepositoriesController],
    providers: [
      RepositoriesConfig,
      RepositoryAddRateLimiter,
      RepositoryAddService,
      RepositoriesHttpService,
      { provide: RepositoriesService, useValue: repositories },
      { provide: IntegrationsGithubService, useValue: github },
      { provide: Clock, useValue: clock },
      { provide: SyncLauncher, useValue: launcher },
      { provide: APP_GUARD, useClass: OriginGuard },
      { provide: APP_GUARD, useClass: JwtGuard },
      { provide: APP_GUARD, useClass: AdminGuard },
      { provide: APP_INTERCEPTOR, useClass: CachePolicyInterceptor },
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
  })
    .overrideProvider(ConfigService).useValue({ get: (key: string, fallback?: unknown) => config[key] ?? fallback })
    .overrideProvider(getRepositoryToken(User)).useValue(userRepo)
    .overrideProvider(getRepositoryToken(RefreshToken)).useValue(refreshTokenRepo)
    .overrideProvider(SESSION_LOOKUP).useValue(new InMemorySessionLookup(userRepo.rows, refreshTokenRepo.rows))
    .overrideProvider(getRepositoryToken(PasswordResetToken)).useValue(createInMemoryRepo<PasswordResetToken>())
    .overrideProvider(getRepositoryToken(AuthorizationRequest)).useValue(createInMemoryRepo<AuthorizationRequest>())
    .overrideProvider(getRepositoryToken(AccountEditLockout)).useValue(createInMemoryRepo<AccountEditLockout>())
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  // Users are seeded directly and their sessions minted through `TokenService#issueTokens`,
  // as in the Integrations harness, so `JwtGuard`'s session gate accepts them.
  const tokenService = app.get(TokenService);
  const sessions = await Promise.all(
    [['darthjee', false], ['intruder', false], ['boss', true]].map(async ([username, isAdmin]) => {
      const user = await userRepo.save(userRepo.create({
        username: username as string,
        email: `${username as string}@example.com`,
        isAdmin: isAdmin as boolean,
        status: 'approved',
      }));
      const { accessToken } = await tokenService.issueTokens(user);

      return { id: user.id, cookie: `access_token=${accessToken}` };
    }),
  );
  const [owner, intruder, admin] = sessions;
  const ctx: RepositoriesTestContext = {
    app, repositories, github, clock, launcher, userRepo,
    ids: { owner: owner.id, intruder: intruder.id, admin: admin.id },
    owner: owner.cookie,
    intruder: intruder.cookie,
    admin: admin.cookie,
  };

  repositories.setLinkSummary((userId, integrationId) => {
    const ref = [OWNER_INTEGRATION, INTRUDER_INTEGRATION].find((candidate) => candidate.id === integrationId);
    const mine = userId === owner.id ? OWNER_INTEGRATION : INTRUDER_INTEGRATION;

    return ref === mine ? { uuid: ref.uuid, label: ref.label } : null;
  });
  seedBaseline(ctx);

  return ctx;
}

/**
 * Registers the per-test app lifecycle and console spies.
 * @param {Record<string, unknown>} [env] - Config overrides.
 * @returns {{ ctx: RepositoriesTestContext, spies: ConsoleSpies }} Live accessors.
 */
export function useRepositoriesTestApp(
  env: Record<string, unknown> = {},
): { ctx: RepositoriesTestContext; spies: ConsoleSpies } {
  const spies = createConsoleSpies();
  let current: RepositoriesTestContext;

  beforeEach(async () => {
    current = await buildRepositoriesTestApp(env);
  });

  afterEach(async () => {
    Object.values(spies).forEach((spy) => spy.mockClear());
    await current.app.close();
  });

  const ctx = new Proxy({} as RepositoriesTestContext, {
    get: (_target, property) => current[property as keyof RepositoriesTestContext],
  });

  return { ctx, spies };
}

/**
 * Starts a request as a given user.
 * @param {INestApplication} app - The app.
 * @param {'get' | 'post' | 'patch'} method - The HTTP method.
 * @param {string} path - The path.
 * @param {string} [cookie] - The access-token cookie, if any.
 * @returns {request.Test} The pending request.
 */
export function call(app: INestApplication, method: 'get' | 'post' | 'patch', path: string, cookie?: string): request.Test {
  const pending = request(app.getHttpServer())[method](path);

  return cookie ? pending.set('Cookie', [cookie]) : pending;
}

/** Keys that must never appear anywhere in a Repositories response body. */
export const FORBIDDEN_BODY_KEYS = [
  'id', 'userId', 'user_id', 'integrationId', 'integration_id', 'secretHint', 'githubLogin', 'github_login',
  'statusReason', 'status_reason', 'holderIntegrationIds', 'handleSeesRepo',
];

/**
 * Every key of a JSON value, nested.
 * @param {unknown} value - The value.
 * @returns {string[]} The keys.
 */
export function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value === null || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
}

/**
 * Asserts a body carries none of the forbidden keys.
 * @param {unknown} body - The response body.
 * @returns {void}
 */
export function expectNoForbiddenKeys(body: unknown): void {
  const keys = keysOf(body);

  FORBIDDEN_BODY_KEYS.forEach((key) => expect(keys).not.toContain(key));
}

/**
 * Asserts the never-cached headers of a response.
 * @param {request.Response} response - The response.
 * @returns {void}
 */
export function expectNeverCached(response: request.Response): void {
  expect(response.headers['x-skip-cache']).toBe('true');
  expect(response.headers['cache-control']).toBe('no-store');
}

/**
 * A body without its timestamp, to compare two error answers.
 * @param {Record<string, unknown>} body - The body.
 * @returns {Record<string, unknown>} The body, `timestamp` nulled.
 */
export function withoutTimestamp(body: Record<string, unknown>): Record<string, unknown> {
  return { ...body, timestamp: null };
}
