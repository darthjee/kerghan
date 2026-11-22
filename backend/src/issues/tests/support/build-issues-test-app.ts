import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { FakeIssueLinksService } from './fake-issue-links.service.js';
import { FakeIssuesService } from './fake-issues.service.js';
import { FakeProjectsService } from './fake-projects.service.js';
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
import { HttpExceptionFilter } from '../../../core/http-exception.filter.js';
import { JwtGuard } from '../../../core/jwt.guard.js';
import { LoggingModule } from '../../../core/logging.module.js';
import { OriginGuard } from '../../../core/origin.guard.js';
import { SESSION_LOOKUP } from '../../../core/session-lookup.js';
import { createConsoleSpies, type ConsoleSpies } from '../../../core/tests/console-spies.test-support.js';
import { IssueLinksController } from '../../issue-links.controller.js';
import { IssueLinksService } from '../../issue-links.service.js';
import { IssueSyncTriggersService } from '../../issue-sync-triggers.service.js';
import { IssuesController } from '../../issues.controller.js';
import { IssuesService } from '../../issues.service.js';
import { ProjectsController } from '../../projects.controller.js';
import { ProjectsService } from '../../projects.service.js';

/** The running app and the doubles behind it. */
export interface IssuesTestContext {
  app: INestApplication;
  projects: FakeProjectsService;
  issues: FakeIssuesService;
  /** The recording stand-in behind the GitHub link routes and the sync trigger routes. */
  links: FakeIssueLinksService;
  ids: { owner: number; intruder: number };
  /** Cookie of `darthjee` (the main user). */
  owner: string;
  /** Cookie of `intruder` (another user). */
  intruder: string;
}

/**
 * Builds the HTTP-layer app: Auth plus the Projects, Issues and GitHub link controllers over fake services, with
 * the global guards, interceptor, filter and `ValidationPipe` as in `AppModule` / `main.ts`
 * (copied from the Repositories test app, so #559 can extend the matrix to every Issues route).
 * Logs in two users through Auth's real `TokenService`.
 * @param {Record<string, unknown>} [env] - Config overrides.
 * @returns {Promise<IssuesTestContext>} The context.
 */
export async function buildIssuesTestApp(env: Record<string, unknown> = {}): Promise<IssuesTestContext> {
  const config: Record<string, unknown> = { KERGHAN_LOG_LEVEL: 'debug', ...env };
  const projects = new FakeProjectsService();
  const issues = new FakeIssuesService();
  const links = new FakeIssueLinksService();
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
    controllers: [ProjectsController, IssuesController, IssueLinksController],
    providers: [
      { provide: ProjectsService, useValue: projects },
      { provide: IssuesService, useValue: issues },
      { provide: IssueLinksService, useValue: links },
      { provide: IssueSyncTriggersService, useValue: links },
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

  const tokenService = app.get(TokenService);
  const sessions = await Promise.all(
    ['darthjee', 'intruder'].map(async (username) => {
      const user = await userRepo.save(userRepo.create({
        username,
        email: `${username}@example.com`,
        isAdmin: false,
        status: 'approved',
      }));
      const { accessToken } = await tokenService.issueTokens(user);

      return { id: user.id, cookie: `access_token=${accessToken}` };
    }),
  );
  const [owner, intruder] = sessions;

  return {
    app,
    projects,
    issues,
    links,
    ids: { owner: owner.id, intruder: intruder.id },
    owner: owner.cookie,
    intruder: intruder.cookie,
  };
}

/**
 * Registers the per-test app lifecycle and console spies.
 * @param {Record<string, unknown>} [env] - Config overrides.
 * @returns {{ ctx: IssuesTestContext, spies: ConsoleSpies }} Live accessors.
 */
export function useIssuesTestApp(env: Record<string, unknown> = {}): { ctx: IssuesTestContext; spies: ConsoleSpies } {
  const spies = createConsoleSpies();
  let current: IssuesTestContext;

  beforeEach(async () => {
    current = await buildIssuesTestApp(env);
  });

  afterEach(async () => {
    Object.values(spies).forEach((spy) => spy.mockClear());
    await current.app.close();
  });

  const ctx = new Proxy({} as IssuesTestContext, {
    get: (_target, property) => current[property as keyof IssuesTestContext],
  });

  return { ctx, spies };
}

/**
 * Starts a request as a given user.
 * @param {INestApplication} app - The app.
 * @param {'get' | 'post'} method - The HTTP method.
 * @param {string} path - The path.
 * @param {string} [cookie] - The access-token cookie, if any.
 * @returns {request.Test} The pending request.
 */
export function call(app: INestApplication, method: 'get' | 'post', path: string, cookie?: string): request.Test {
  const pending = request(app.getHttpServer())[method](path);

  return cookie ? pending.set('Cookie', [cookie]) : pending;
}

/**
 * Asserts a response is never cached: `X-Skip-Cache: true` and `Cache-Control: no-store`.
 * @param {request.Response} response - The response.
 * @returns {void}
 */
export function expectNeverCached(response: request.Response): void {
  expect(response.headers['x-skip-cache']).toBe('true');
  expect(response.headers['cache-control']).toBe('no-store');
}

/** Keys that must never appear anywhere in a Projects or Issues response body. */
export const FORBIDDEN_BODY_KEYS = [
  'userId', 'user_id', 'repositoryId', 'repository_id', 'integrationId', 'integration_id', 'secretHint', 'deletedAt', 'deleted_at',
  'deletedToken', 'deleted_token', 'githubLogin', 'github_login', 'projectId', 'project_id',
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
 * A body without its timestamp, to compare two error answers.
 * @param {Record<string, unknown>} body - The body.
 * @returns {Record<string, unknown>} The body, `timestamp` nulled.
 */
export function withoutTimestamp(body: Record<string, unknown>): Record<string, unknown> {
  return { ...body, timestamp: null };
}
