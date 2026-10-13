import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ProtectedTestController } from './auth.controller.e2e-test-support.js';
import { DefaultUserSettings } from '../default-user.config.js';
import {
  findSetCookie,
  loginAs,
  pickCookie,
  refreshCookieFor,
  refreshTokenOf,
  setCookieHeaders,
} from './support/auth-requests.js';
import { DEFAULT_PASSWORD, ENABLED_DEFAULT_USER, seedUser, useDefaultUserApp } from './support/default-user-e2e.js';
import { RevokedReason } from '../entities/refresh-token.entity.js';
import { User } from '../entities/user.entity.js';

const ALWAYS_AUTHENTICATED: Partial<DefaultUserSettings> = { ...ENABLED_DEFAULT_USER, alwaysAuthenticated: true };
const REGULAR_TTL_S = 7 * 24 * 60 * 60;
const ACCESS_TTL_S = 15 * 60;
const SESSION_COOKIES = ['access_token', 'refresh_token', 'logged_in'];

function status(app: INestApplication, cookies: string[] = [], forwardedFor?: string): request.Test {
  const req = request(app.getHttpServer()).post('/auth/status.json');

  if (forwardedFor) {
    req.set('X-Forwarded-For', forwardedFor);
  }

  return cookies.length > 0 ? req.set('Cookie', cookies) : req;
}

function maxAgeOf(response: request.Response, name: string): number {
  return Number(/Max-Age=(\d+)/.exec(findSetCookie(response, name) ?? '')?.[1]);
}

function expectSessionCookiesCleared(response: request.Response): void {
  expect(findSetCookie(response, 'access_token')).toMatch(/^access_token=;.*Path=\/;/);
  expect(findSetCookie(response, 'refresh_token')).toMatch(/^refresh_token=;.*Path=\/auth;/);
  expect(findSetCookie(response, 'logged_in')).toMatch(/^logged_in=;.*Path=\/;/);
}

function expectLoggedOutResponse(response: request.Response): void {
  expect(response.body).toEqual({ loggedIn: false, isAdmin: false });
  expectSessionCookiesCleared(response);
}

// Strips the cookie value, `Max-Age` and `Expires` (all may differ between two
// issuances; `Max-Age` is asserted separately), keeping every other attribute
// in order.
function cookieAttributes(response: request.Response, name: string): string {
  return (findSetCookie(response, name) ?? '')
    .split('; ')
    .slice(1)
    .filter((attribute) => !/^(Expires|Max-Age)=/.test(attribute))
    .join('; ');
}

describe('AuthController automatic login (e2e)', () => {
  describe('with always-authenticated on and the loopback default allowlist', () => {
    const ctx = useDefaultUserApp({
      defaultUserSettings: ALWAYS_AUTHENTICATED,
      controllers: [ProtectedTestController],
      beforeInit: async ({ userRepo }) => {
        await seedUser(userRepo, { username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });
      },
    });

    const defaultUser = (): User => ctx.userRepo.rows.find((row) => row.username === 'admin') as User;
    const darthjee = (): User => ctx.userRepo.rows.find((row) => row.username === 'darthjee') as User;

    describe('with no cookie from an allowed IP', () => {
      it('answers exactly { loggedIn: true, isAdmin } with isAdmin from the default user', async () => {
        const response = await status(ctx.app).expect(201);

        expect(response.body).toEqual({ loggedIn: true, isAdmin: true });
      });

      it('takes isAdmin from the default user when it is not an admin', async () => {
        defaultUser().isAdmin = false;

        const response = await status(ctx.app).expect(201);

        expect(response.body).toEqual({ loggedIn: true, isAdmin: false });
      });

      it('creates a regular session for the default user', async () => {
        await status(ctx.app).expect(201);

        expect(ctx.refreshTokenRepo.rows).toHaveLength(1);
        const [row] = ctx.refreshTokenRepo.rows;
        expect(row).toMatchObject({ userId: defaultUser().id, keepSignedIn: false, revokedAt: null });
        const ttlMs = row.expiresAt.getTime() - Date.now();
        expect(ttlMs).toBeGreaterThan((REGULAR_TTL_S - 5) * 1000);
        expect(ttlMs).toBeLessThanOrEqual(REGULAR_TTL_S * 1000);
      });

      it('sets the three session cookies with the regular TTLs', async () => {
        const response = await status(ctx.app).expect(201);

        expect(findSetCookie(response, 'logged_in')).toMatch(/^logged_in=1;/);
        expect(refreshTokenOf(response)).toEqual(expect.any(String));
        expect(maxAgeOf(response, 'access_token')).toBe(ACCESS_TTL_S);

        for (const name of ['refresh_token', 'logged_in']) {
          expect(maxAgeOf(response, name)).toBeGreaterThanOrEqual(REGULAR_TTL_S - 5);
          expect(maxAgeOf(response, name)).toBeLessThanOrEqual(REGULAR_TTL_S);
        }
      });

      it('sets cookies with the same names and attributes as login.json', async () => {
        const auto = await status(ctx.app).expect(201);
        const login = await loginAs(ctx.app, 'admin', DEFAULT_PASSWORD).expect(201);

        for (const name of SESSION_COOKIES) {
          expect(cookieAttributes(auto, name)).toBe(cookieAttributes(login, name));
        }
        expect(cookieAttributes(auto, 'access_token')).toMatch(/HttpOnly; Secure; SameSite=Strict/);
        expect(cookieAttributes(auto, 'refresh_token')).toMatch(/Path=\/auth; .*HttpOnly; Secure; SameSite=Strict/);
        expect(cookieAttributes(auto, 'logged_in')).not.toMatch(/HttpOnly/);
      });

      it('marks the response never-cacheable', async () => {
        const response = await status(ctx.app).expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('creates a session usable for protected endpoints and listed as current', async () => {
        const response = await status(ctx.app).expect(201);
        const cookies = [pickCookie(response, 'access_token'), pickCookie(response, 'refresh_token')];

        const listed = await request(ctx.app.getHttpServer())
          .post('/auth/sessions/mine.json')
          .set('Cookie', cookies)
          .expect(201);

        expect(listed.body.sessions).toEqual([
          expect.objectContaining({ keepSignedIn: false, current: true }),
        ]);
      });

      it('gives every cookie-less client its own session', async () => {
        await status(ctx.app).expect(201);
        await status(ctx.app).expect(201);

        expect(ctx.refreshTokenRepo.rows).toHaveLength(2);
      });
    });

    describe('with an unknown refresh cookie', () => {
      it('logs in automatically', async () => {
        const response = await status(ctx.app, [refreshCookieFor('not-a-real-token')]).expect(201);

        expect(response.body).toEqual({ loggedIn: true, isAdmin: true });
        expect(findSetCookie(response, 'logged_in')).toMatch(/^logged_in=1;/);
      });
    });

    describe.each([
      ['expired', (row: { expiresAt: Date }): void => {
        row.expiresAt = new Date(Date.now() - 1000);
      }],
      ['revoked', (row: { revokedAt: Date | null; revokedReason: RevokedReason | null }): void => {
        row.revokedAt = new Date();
        row.revokedReason = RevokedReason.USER_REVOKED;
      }],
    ])('with an %s refresh cookie of another user', (_label, invalidate) => {
      it('logs in automatically as the default user, revoking nothing else', async () => {
        const token = refreshTokenOf(await loginAs(ctx.app).expect(201));
        const [row] = ctx.refreshTokenRepo.rows;
        invalidate(row as never);
        const before = ctx.refreshTokenRepo.rows.map((entry) => ({ ...entry }));

        const response = await status(ctx.app, [refreshCookieFor(token)]).expect(201);

        expect(response.body).toEqual({ loggedIn: true, isAdmin: true });
        expect(ctx.refreshTokenRepo.rows.slice(0, before.length)).toEqual(before);
        expect(ctx.refreshTokenRepo.rows.at(-1)).toMatchObject({ userId: defaultUser().id });
      });
    });

    describe('with a valid refresh cookie', () => {
      it('keeps an explicit login as another user, issuing no session', async () => {
        const token = refreshTokenOf(await loginAs(ctx.app).expect(201));

        const response = await status(ctx.app, [refreshCookieFor(token)]).expect(201);

        expect(response.body).toEqual({ loggedIn: true, isAdmin: false });
        expect(setCookieHeaders(response)).toEqual([]);
        expect(ctx.refreshTokenRepo.rows).toHaveLength(1);
        expect(ctx.refreshTokenRepo.rows[0]).toMatchObject({ userId: darthjee().id, revokedAt: null });
      });

      it('follows the existing flow with an expired access token, not automatic login', async () => {
        const login = await loginAs(ctx.app).expect(201);
        const cookies = ['access_token=expired.or.garbage', refreshCookieFor(refreshTokenOf(login))];

        const response = await status(ctx.app, cookies).expect(201);

        expect(response.body).toEqual({ loggedIn: true, isAdmin: false });
        expect(ctx.refreshTokenRepo.rows).toHaveLength(1);

        await request(ctx.app.getHttpServer())
          .post('/auth/refresh.json')
          .set('Cookie', [refreshCookieFor(refreshTokenOf(login))])
          .expect(201)
          .expect(({ body }) => expect(body.user).toMatchObject({ username: 'darthjee' }));
      });
    });

    it('still answers 401 on a protected endpoint without a cookie, issuing no session', async () => {
      await request(ctx.app.getHttpServer()).get('/protected').expect(401);

      expect(ctx.refreshTokenRepo.rows).toHaveLength(0);
    });

    it('logs in again after logout', async () => {
      const first = await status(ctx.app).expect(201);
      const token = refreshTokenOf(first);

      await request(ctx.app.getHttpServer())
        .delete('/auth/logoff.json')
        .set('Cookie', [refreshCookieFor(token)])
        .expect(204);

      const second = await status(ctx.app, [refreshCookieFor(token)]).expect(201);

      expect(second.body).toEqual({ loggedIn: true, isAdmin: true });
      expect(refreshTokenOf(second)).not.toBe(token);
      expect(ctx.refreshTokenRepo.rows[0].revokedReason).toBe(RevokedReason.LOGOUT);
    });

    describe('from a disallowed IP', () => {
      it('answers exactly the logged-out response, with the session cookies cleared', async () => {
        const response = await status(ctx.app, [], '203.0.113.9').expect(201);

        expectLoggedOutResponse(response);
        expect(ctx.refreshTokenRepo.rows).toHaveLength(0);
      });

      it('ignores a forged X-Forwarded-For hop beyond the trusted proxy hops', async () => {
        const response = await status(ctx.app, [], '127.0.0.1, 203.0.113.9').expect(201);

        expectLoggedOutResponse(response);
        expect(ctx.refreshTokenRepo.rows).toHaveLength(0);
      });

      it('logs in when the trusted hop itself is allowed', async () => {
        const response = await status(ctx.app, [], '203.0.113.9, 127.0.0.1').expect(201);

        expect(response.body).toEqual({ loggedIn: true, isAdmin: true });
      });
    });
  });

  describe('with a configured allowlist', () => {
    const ctx = useDefaultUserApp({
      defaultUserSettings: { ...ALWAYS_AUTHENTICATED, allowedIps: ['10.0.0.0/8'] },
    });

    it('logs in a client inside the range', async () => {
      const response = await status(ctx.app, [], '10.1.2.3').expect(201);

      expect(response.body).toEqual({ loggedIn: true, isAdmin: true });
    });

    it('does not log in loopback, which is no longer allowed', async () => {
      const response = await status(ctx.app).expect(201);

      expectLoggedOutResponse(response);
    });
  });

  describe('with the default user enabled but always-authenticated off', () => {
    const ctx = useDefaultUserApp({ defaultUserSettings: ENABLED_DEFAULT_USER });

    it('answers exactly the logged-out response, with the session cookies cleared', async () => {
      const response = await status(ctx.app).expect(201);

      expectLoggedOutResponse(response);
      expect(ctx.refreshTokenRepo.rows).toHaveLength(0);
    });
  });

  describe('with the feature off', () => {
    const ctx = useDefaultUserApp({});

    it('answers exactly the logged-out response, with the session cookies cleared', async () => {
      const response = await status(ctx.app).expect(201);

      expectLoggedOutResponse(response);
      expect(ctx.refreshTokenRepo.rows).toHaveLength(0);
    });
  });
});
