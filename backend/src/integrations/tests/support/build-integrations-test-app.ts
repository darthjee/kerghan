import { randomBytes } from 'node:crypto';
import { inspect } from 'node:util';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { FakeGithubClient } from './fake-github-client.js';
import {
  createInMemoryIntegrationRepo,
  InMemoryCredentialAbuseGuard,
  InMemoryIntegrationRepo,
  InMemoryTestCooldown,
} from './in-memory-integrations.js';
import { createInMemoryOauthStateRepo, InMemoryOauthStateRepo } from './in-memory-oauth-states.js';
import { CANARY_CLASSIC, CANARY_FRAGMENT } from './integrations-harness.js';
import { AuthModule } from '../../../auth/auth.module.js';
import { AccountEditLockout } from '../../../auth/entities/account-edit-lockout.entity.js';
import { AuthorizationRequest } from '../../../auth/entities/authorization-request.entity.js';
import { PasswordResetToken } from '../../../auth/entities/password-reset-token.entity.js';
import { RefreshToken } from '../../../auth/entities/refresh-token.entity.js';
import { Session } from '../../../auth/entities/session.entity.js';
import { User } from '../../../auth/entities/user.entity.js';
import { createInMemoryRepo } from '../../../auth/tests/support/in-memory-repo.js';
import { AdminGuard } from '../../../core/admin.guard.js';
import { CachePolicyInterceptor } from '../../../core/cache-policy.interceptor.js';
import { HttpExceptionFilter } from '../../../core/http-exception.filter.js';
import { JwtGuard } from '../../../core/jwt.guard.js';
import { LoggingModule } from '../../../core/logging.module.js';
import { OriginGuard } from '../../../core/origin.guard.js';
import { createConsoleSpies, ConsoleSpies } from '../../../core/tests/console-spies.test-support.js';
import { IntegrationCredentialLockout } from '../../entities/integration-credential-lockout.entity.js';
import { IntegrationOauthState } from '../../entities/integration-oauth-state.entity.js';
import { Integration } from '../../entities/integration.entity.js';
import { GithubClientService } from '../../github-client.service.js';
import { IntegrationCredentialAbuseGuardService } from '../../integration-credential-abuse-guard.service.js';
import { IntegrationTestCooldownService } from '../../integration-test-cooldown.service.js';
import { IntegrationsModule } from '../../integrations.module.js';

export const TEST_COOLDOWN_MS = 30000;
export const TEST_MAX_PER_USER = 3;
export const TEST_MAX_ATTEMPTS = 3;
/** The fake OAuth App client id used when the type is enabled. */
export const TEST_OAUTH_CLIENT_ID = 'Ov23liTestClient0001';
/** A recognisable OAuth App client secret that must never leak anywhere. */
export const CANARY_OAUTH_CLIENT_SECRET = 'CANARYcanaryCLIENTSECRET000000000000000a';
/** The frontend base URL the OAuth App callback URL derives from. */
export const TEST_FRONTEND_BASE_URL = 'https://kerghan.example.com/app/';
/** The callback URL derived from `TEST_FRONTEND_BASE_URL`. */
export const TEST_OAUTH_CALLBACK_URL = 'https://kerghan.example.com/integrations/oauth_app/callback';

/** How to build the test app. */
export interface IntegrationsTestAppOptions {
  /** Enables the `oauth_app` type (fake client id and secret, `FRONTEND_BASE_URL`). */
  oauthApp?: boolean;
}

/** The running app and the doubles behind it. */
export interface IntegrationsTestContext {
  app: INestApplication;
  repo: InMemoryIntegrationRepo;
  oauthStates: InMemoryOauthStateRepo;
  github: FakeGithubClient;
  guard: InMemoryCredentialAbuseGuard;
  userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  /** Cookie of `darthjee` (the main user). */
  owner: string;
  /** Cookie of `intruder` (another, non-admin user). */
  intruder: string;
  /** Cookie of `boss` (an admin). */
  admin: string;
}

/**
 * Builds the app: Auth + Integrations, the global guards, interceptor,
 * filter and `ValidationPipe` as in `AppModule`/`main.ts`, in-memory
 * repositories, the fake GitHub client and in-memory doubles of the atomic
 * cool-off and cooldown services. Logs in two users and an admin.
 * @param {IntegrationsTestAppOptions} [options] - Whether the `oauth_app` type is enabled.
 * @returns {Promise<IntegrationsTestContext>} The context.
 */
export async function buildIntegrationsTestApp(options: IntegrationsTestAppOptions = {}): Promise<IntegrationsTestContext> {
  const config: Record<string, unknown> = {
    KERGHAN_INTEGRATIONS_KEY: randomBytes(32).toString('base64'),
    KERGHAN_INTEGRATIONS_MAX_PER_USER: TEST_MAX_PER_USER,
    KERGHAN_LOG_LEVEL: 'debug',
    ...(options.oauthApp ? {
      KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID: TEST_OAUTH_CLIENT_ID,
      KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET: CANARY_OAUTH_CLIENT_SECRET,
      FRONTEND_BASE_URL: TEST_FRONTEND_BASE_URL,
    } : {}),
  };
  const repo = createInMemoryIntegrationRepo();
  const oauthStates = createInMemoryOauthStateRepo();
  const github = new FakeGithubClient();
  const guard = new InMemoryCredentialAbuseGuard(TEST_MAX_ATTEMPTS);
  const userRepo = createInMemoryRepo<User>();

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      EventEmitterModule.forRoot(),
      JwtModule.register({ global: true, secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
      LoggingModule,
      AuthModule,
      IntegrationsModule,
    ],
    providers: [
      { provide: APP_GUARD, useClass: OriginGuard },
      { provide: APP_GUARD, useClass: JwtGuard },
      { provide: APP_GUARD, useClass: AdminGuard },
      { provide: APP_INTERCEPTOR, useClass: CachePolicyInterceptor },
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
  })
    .overrideProvider(ConfigService).useValue({ get: (key: string, fallback?: unknown) => config[key] ?? fallback })
    .overrideProvider(getRepositoryToken(User)).useValue(userRepo)
    .overrideProvider(getRepositoryToken(RefreshToken)).useValue(createInMemoryRepo<RefreshToken>())
    .overrideProvider(getRepositoryToken(Session)).useValue(createInMemoryRepo<Session>())
    .overrideProvider(getRepositoryToken(PasswordResetToken)).useValue(createInMemoryRepo<PasswordResetToken>())
    .overrideProvider(getRepositoryToken(AuthorizationRequest)).useValue(createInMemoryRepo<AuthorizationRequest>())
    .overrideProvider(getRepositoryToken(AccountEditLockout)).useValue(createInMemoryRepo<AccountEditLockout>())
    .overrideProvider(getRepositoryToken(Integration)).useValue(repo)
    .overrideProvider(getRepositoryToken(IntegrationCredentialLockout)).useValue({})
    .overrideProvider(getRepositoryToken(IntegrationOauthState)).useValue(oauthStates)
    .overrideProvider(GithubClientService).useValue(github)
    .overrideProvider(IntegrationCredentialAbuseGuardService).useValue(guard)
    .overrideProvider(IntegrationTestCooldownService).useValue(new InMemoryTestCooldown(repo, TEST_COOLDOWN_MS))
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  // Users are seeded directly and their access tokens signed with the app's own `JwtService`
  // (exactly what a login issues), skipping bcrypt so each test app builds fast.
  const jwtService = app.get(JwtService);
  const [owner, intruder, admin] = await Promise.all(
    [['darthjee', false], ['intruder', false], ['boss', true]].map(async ([username, isAdmin]) => {
      const user = await userRepo.save(userRepo.create({ username: username as string, isAdmin: isAdmin as boolean }));
      const token = jwtService.sign({ sub: user.id, username: user.username, isAdmin: user.isAdmin });

      return `access_token=${token}`;
    }),
  );

  return { app, repo, oauthStates, github, guard, userRepo, owner, intruder, admin };
}

/**
 * Registers the per-test app lifecycle and console spies, and asserts after
 * every test that the canary never reached a log line.
 * @param {IntegrationsTestAppOptions} [options] - Whether the `oauth_app` type is enabled.
 * @returns {{ ctx: IntegrationsTestContext, spies: ConsoleSpies }} Live accessors.
 */
export function useIntegrationsTestApp(
  options: IntegrationsTestAppOptions = {},
): { ctx: IntegrationsTestContext; spies: ConsoleSpies } {
  const spies = createConsoleSpies();
  let current: IntegrationsTestContext;

  beforeEach(async () => {
    current = await buildIntegrationsTestApp(options);
  });

  afterEach(async () => {
    const logged = Object.values(spies).flatMap((spy) => spy.mock.calls);
    expect(inspect(logged, { depth: 10 })).not.toContain(CANARY_FRAGMENT);
    Object.values(spies).forEach((spy) => spy.mockClear());
    await current.app.close();
  });

  const ctx = new Proxy({} as IntegrationsTestContext, {
    get: (_target, property) => current[property as keyof IntegrationsTestContext],
  });

  return { ctx, spies };
}

/**
 * Starts a request as a given user.
 * @param {INestApplication} app - The app.
 * @param {'get' | 'post' | 'patch' | 'delete'} method - The HTTP method.
 * @param {string} path - The path.
 * @param {string} [cookie] - The access-token cookie, if any.
 * @returns {request.Test} The pending request.
 */
export function call(
  app: INestApplication,
  method: 'post' | 'patch' | 'delete',
  path: string,
  cookie?: string,
): request.Test {
  const pending = request(app.getHttpServer())[method](path);

  return cookie ? pending.set('Cookie', [cookie]) : pending;
}

/**
 * Creates an integration for a user through the API.
 * @param {IntegrationsTestContext} ctx - The context.
 * @param {string} cookie - The user's cookie.
 * @param {Record<string, unknown>} [overrides] - Envelope overrides.
 * @returns {Promise<request.Response>} The response.
 */
export function createIntegration(
  ctx: IntegrationsTestContext,
  cookie: string,
  overrides: Record<string, unknown> = {},
): Promise<request.Response> {
  return call(ctx.app, 'post', '/integrations.json', cookie)
    .send({ label: 'Work', provider: 'github', type: 'pat', credential: { token: CANARY_CLASSIC }, ...overrides })
    .then((response) => response);
}

/**
 * Asserts a response body holds no credential, secret column, internal id or owner.
 * @param {unknown} body - The response body.
 * @returns {void}
 */
export function expectSafeBody(body: unknown): void {
  const text = JSON.stringify(body) ?? '';

  expect(text).not.toContain(CANARY_FRAGMENT);
  expect(text).not.toMatch(/"(secretKeyId|secretIv|secretAuthTag|secretCiphertext|userId|user_id|credential|token)"/);
}
